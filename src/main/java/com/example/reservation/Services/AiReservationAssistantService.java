package com.example.reservation.Services;

import com.example.reservation.Dto.AiReservationAssistantResponse;
import com.example.reservation.Entities.Equipment;
import com.example.reservation.Entities.Enums.ReservationStatus;
import com.example.reservation.Entities.Enums.ResourceStatus;
import com.example.reservation.Entities.Room;
import com.example.reservation.Repository.EquipmentRepository;
import com.example.reservation.Repository.ReservationRepository;
import com.example.reservation.Repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AiReservationAssistantService {
    private final RoomRepository roomRepository;
    private final EquipmentRepository equipmentRepository;
    private final ReservationRepository reservationRepository;

    private static final int LARGE_ROOM_CAPACITY = 20;
    private static final int BUFFER_MINUTES = 30;
    private static final int BUSINESS_HOUR_START = 8;
    private static final int BUSINESS_HOUR_END = 18;
    private static final int LONG_DURATION_HOURS = 4;

    public AiReservationAssistantResponse recommend(String prompt) {
        String safePrompt = prompt == null ? "" : prompt.trim();
        String normalizedPrompt = normalize(safePrompt);

        int requestedCapacity = extractCapacity(normalizedPrompt);
        int durationHours = extractDurationHours(normalizedPrompt);
        LocalDate targetDate = extractTargetDate(normalizedPrompt);
        TimePreference timePreference = extractTimePreference(normalizedPrompt);

        Room room = chooseRoom(requestedCapacity).orElse(null);
        Equipment equipment = chooseEquipment(normalizedPrompt).orElse(null);
        LocalDateTime[] slot = chooseSlot(targetDate, timePreference, durationHours, room, equipment);

        List<String> extractedNeeds = new ArrayList<>();
        extractedNeeds.add("Capacity needed: " + requestedCapacity + " person(s)");
        extractedNeeds.add("Preferred period: " + timePreference.label);
        extractedNeeds.add("Duration: " + durationHours + " hour(s)");

        List<String> reasons = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (room != null) {
            reasons.add("Recommended room: " + room.getName() + " because its capacity fits the request.");
            if (room.getCapacity() != null && room.getCapacity() >= LARGE_ROOM_CAPACITY) {
                warnings.add("The selected room is large, so admin validation will be required.");
            }
        } else {
            warnings.add("No available room matches the requested capacity.");
        }

        if (equipment != null) {
            reasons.add("Recommended equipment: " + equipment.getName() + " based on the keywords in the request.");
            if (equipment.isSensitive()) {
                warnings.add("The selected equipment is sensitive, so admin validation will be required.");
            }
        } else if (mentionsEquipment(normalizedPrompt)) {
            warnings.add("The request mentions equipment, but no available matching equipment was found.");
        }

        if (slot == null) {
            slot = fallbackSlot(targetDate, timePreference, durationHours);
            warnings.add("No conflict-free slot was found for the selected resource. A fallback slot is suggested for manual review.");
        } else {
            reasons.add("Suggested slot is conflict-free with the 30-minute preparation/cleanup buffer.");
        }

        ReservationStatus expectedStatus = estimateStatus(room, equipment, slot[0], slot[1]);
        int confidence = computeConfidence(room, equipment, slot, warnings, normalizedPrompt);
        String summary = buildSummary(room, equipment, slot[0], slot[1], expectedStatus);

        return AiReservationAssistantResponse.builder()
                .roomId(room != null ? room.getId() : null)
                .roomName(room != null ? room.getName() : null)
                .requestedCapacity(requestedCapacity)
                .equipmentId(equipment != null ? equipment.getId() : null)
                .equipmentName(equipment != null ? equipment.getName() : null)
                .suggestedStartTime(slot[0])
                .suggestedEndTime(slot[1])
                .expectedStatus(expectedStatus)
                .confidence(confidence)
                .summary(summary)
                .extractedNeeds(extractedNeeds)
                .reasons(reasons)
                .warnings(warnings)
                .build();
    }

    private Optional<Room> chooseRoom(int requestedCapacity) {
        return roomRepository.findAll().stream()
                .filter(room -> room.getStatus() == ResourceStatus.AVAILABLE)
                .filter(room -> room.getCapacity() != null && room.getCapacity() >= requestedCapacity)
                .min(Comparator.comparingInt(room -> room.getCapacity() - requestedCapacity));
    }

    private Optional<Equipment> chooseEquipment(String prompt) {
        if (!mentionsEquipment(prompt)) {
            return Optional.empty();
        }

        List<String> keywords = equipmentKeywords(prompt);
        return equipmentRepository.findAll().stream()
                .filter(equipment -> equipment.getStatus() == ResourceStatus.AVAILABLE)
                .filter(equipment -> keywords.isEmpty() || keywords.stream().anyMatch(keyword -> equipmentMatches(equipment, keyword)))
                .findFirst();
    }

    private LocalDateTime[] chooseSlot(
            LocalDate targetDate,
            TimePreference preference,
            int durationHours,
            Room room,
            Equipment equipment
    ) {
        for (int startHour : preference.candidateHours) {
            LocalDateTime start = LocalDateTime.of(targetDate, LocalTime.of(startHour, 0));
            LocalDateTime end = start.plusHours(durationHours);

            if (start.isBefore(LocalDateTime.now())) {
                continue;
            }

            if (!hasConflict(room, equipment, start, end)) {
                return new LocalDateTime[] { start, end };
            }
        }

        return null;
    }

    private boolean hasConflict(Room room, Equipment equipment, LocalDateTime start, LocalDateTime end) {
        LocalDateTime effectiveStart = start.minusMinutes(BUFFER_MINUTES);
        LocalDateTime effectiveEnd = end.plusMinutes(BUFFER_MINUTES);

        boolean roomConflict = room != null && !reservationRepository
                .findConflictingReservationsForRoom(room.getId(), effectiveStart, effectiveEnd)
                .isEmpty();
        boolean equipmentConflict = equipment != null && !reservationRepository
                .findConflictingReservationsForEquipment(equipment.getId(), effectiveStart, effectiveEnd)
                .isEmpty();

        return roomConflict || equipmentConflict;
    }

    private LocalDateTime[] fallbackSlot(LocalDate targetDate, TimePreference preference, int durationHours) {
        LocalDateTime start = LocalDateTime.of(targetDate, LocalTime.of(preference.candidateHours.get(0), 0));
        if (start.isBefore(LocalDateTime.now())) {
            start = LocalDateTime.now().plusHours(1).truncatedTo(ChronoUnit.HOURS);
        }
        return new LocalDateTime[] { start, start.plusHours(durationHours) };
    }

    private ReservationStatus estimateStatus(Room room, Equipment equipment, LocalDateTime start, LocalDateTime end) {
        boolean requiresValidation =
                room != null && room.getCapacity() != null && room.getCapacity() >= LARGE_ROOM_CAPACITY ||
                equipment != null && equipment.isSensitive() ||
                ChronoUnit.MINUTES.between(start, end) > LONG_DURATION_HOURS * 60L ||
                start.getHour() < BUSINESS_HOUR_START ||
                end.getHour() >= BUSINESS_HOUR_END ||
                start.getDayOfWeek() == DayOfWeek.SATURDAY ||
                start.getDayOfWeek() == DayOfWeek.SUNDAY;

        return requiresValidation ? ReservationStatus.PENDING : ReservationStatus.APPROVED;
    }

    private int computeConfidence(Room room, Equipment equipment, LocalDateTime[] slot, List<String> warnings, String prompt) {
        int score = 55;
        if (room != null) {
            score += 20;
        }
        if (!mentionsEquipment(prompt) || equipment != null) {
            score += 15;
        }
        if (slot != null) {
            score += 10;
        }
        score -= warnings.size() * 8;
        return Math.max(20, Math.min(score, 95));
    }

    private String buildSummary(Room room, Equipment equipment, LocalDateTime start, LocalDateTime end, ReservationStatus status) {
        String roomName = room != null ? room.getName() : "no room selected";
        String equipmentName = equipment != null ? " with " + equipment.getName() : "";
        String decision = status == ReservationStatus.PENDING ? "admin validation required" : "automatic approval expected";
        return "AI recommendation: book " + roomName + equipmentName + " from " + start + " to " + end + " (" + decision + ").";
    }

    private int extractCapacity(String prompt) {
        Matcher matcher = Pattern.compile("\\b(\\d{1,3})\\b").matcher(prompt);
        while (matcher.find()) {
            int value = Integer.parseInt(matcher.group(1));
            if (value > 0 && value <= 300) {
                return value;
            }
        }
        return prompt.contains("group") ||
                prompt.contains("class") ||
                prompt.contains("students") ||
                prompt.contains("student") ||
                prompt.contains("etudiants") ||
                prompt.contains("classe") ? 20 : 1;
    }

    private int extractDurationHours(String prompt) {
        Matcher matcher = Pattern.compile("(\\d{1,2})\\s*(h|hour|hours)").matcher(prompt);
        if (matcher.find()) {
            return Math.max(1, Math.min(Integer.parseInt(matcher.group(1)), 8));
        }
        return prompt.contains("long") || prompt.contains("half day") ? 4 : 2;
    }

    private LocalDate extractTargetDate(String prompt) {
        LocalDate today = LocalDate.now();
        if (prompt.contains("today")) {
            return today;
        }
        if (prompt.contains("after tomorrow")) {
            return today.plusDays(2);
        }
        if (prompt.contains("tomorrow") || prompt.contains("demain")) {
            return today.plusDays(1);
        }
        return today.plusDays(1);
    }

    private TimePreference extractTimePreference(String prompt) {
        if (prompt.contains("afternoon") || prompt.contains("pm") || prompt.contains("apres") || prompt.contains("après")) {
            return new TimePreference("Afternoon", List.of(14, 15, 16));
        }
        if (prompt.contains("evening") || prompt.contains("night")) {
            return new TimePreference("Evening", List.of(18, 19));
        }
        if (prompt.contains("morning") || prompt.contains("am") || prompt.contains("matin")) {
            return new TimePreference("Morning", List.of(8, 9, 10, 11));
        }
        return new TimePreference("Any standard slot", List.of(8, 10, 14, 16));
    }

    private boolean mentionsEquipment(String prompt) {
        return prompt.contains("projector") ||
                prompt.contains("projecteur") ||
                prompt.contains("video") ||
                prompt.contains("computer") ||
                prompt.contains("ordinateur") ||
                prompt.contains("laptop") ||
                prompt.contains("printer") ||
                prompt.contains("imprimante") ||
                prompt.contains("microphone") ||
                prompt.contains("micro") ||
                prompt.contains("camera") ||
                prompt.contains("equipment") ||
                prompt.contains("materiel") ||
                prompt.contains("matériel");
    }

    private List<String> equipmentKeywords(String prompt) {
        List<String> keywords = new ArrayList<>();
        if (prompt.contains("projector") || prompt.contains("projecteur") || prompt.contains("video")) {
            keywords.add("project");
            keywords.add("proj");
            keywords.add("video");
        }
        if (prompt.contains("computer") || prompt.contains("ordinateur") || prompt.contains("laptop")) {
            keywords.add("computer");
            keywords.add("ordinateur");
            keywords.add("pc");
            keywords.add("laptop");
        }
        if (prompt.contains("printer") || prompt.contains("imprimante")) {
            keywords.add("printer");
            keywords.add("imprimante");
        }
        if (prompt.contains("microphone") || prompt.contains("micro")) {
            keywords.add("micro");
        }
        if (prompt.contains("camera")) {
            keywords.add("camera");
        }
        return keywords;
    }

    private boolean equipmentMatches(Equipment equipment, String keyword) {
        return normalize(equipment.getName()).contains(keyword) ||
                normalize(equipment.getType()).contains(keyword) ||
                normalize(equipment.getReference()).contains(keyword);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        String withoutAccents = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return withoutAccents.toLowerCase();
    }

    private record TimePreference(String label, List<Integer> candidateHours) {
    }
}
