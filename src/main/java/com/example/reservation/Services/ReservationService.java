package com.example.reservation.Services;

import com.example.reservation.Dto.ReservationRuleDecisionResponse;
import com.example.reservation.Dto.ReservationRulePreviewRequest;
import com.example.reservation.Entities.Equipment;
import com.example.reservation.Entities.Enums.ReservationStatus;
import com.example.reservation.Entities.Enums.ResourceStatus;
import com.example.reservation.Entities.Reservation;
import com.example.reservation.Entities.ReservationBlockPeriod;
import com.example.reservation.Entities.Room;
import com.example.reservation.Repository.EquipmentRepository;
import com.example.reservation.Repository.ReservationBlockPeriodRepository;
import com.example.reservation.Repository.ReservationRepository;
import com.example.reservation.Repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReservationService {
    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final EquipmentRepository equipmentRepository;
    private final ReservationBlockPeriodRepository reservationBlockPeriodRepository;

    private static final int MAX_DURATION_HOURS = 8;
    private static final int LONG_DURATION_VALIDATION_THRESHOLD_HOURS = 4;
    private static final int LARGE_ROOM_VALIDATION_CAPACITY = 20;
    private static final int BUSINESS_HOUR_START = 8;
    private static final int BUSINESS_HOUR_END = 18;
    private static final int BUFFER_MINUTES_BEFORE = 30;
    private static final int BUFFER_MINUTES_AFTER = 30;

    @Transactional
    public Reservation createReservation(Reservation reservationRequest) {
        EvaluatedReservation evaluatedReservation = evaluateReservation(
                reservationRequest.getStartTime(),
                reservationRequest.getEndTime(),
                reservationRequest.getRoom() != null ? reservationRequest.getRoom().getId() : null,
                extractEquipmentIds(reservationRequest.getEquipments())
        );

        if (evaluatedReservation.decision().isBlocked()) {
            throw new IllegalArgumentException(String.join(" ", evaluatedReservation.decision().getBlockingReasons()));
        }

        reservationRequest.setRoom(evaluatedReservation.room());
        reservationRequest.setEquipments(evaluatedReservation.equipments());
        reservationRequest.setStatus(evaluatedReservation.decision().getFinalStatus());

        return reservationRepository.save(reservationRequest);
    }

    public ReservationRuleDecisionResponse previewReservationRules(ReservationRulePreviewRequest request) {
        return evaluateReservation(
                request.getStartTime(),
                request.getEndTime(),
                request.getRoomId(),
                request.getEquipmentIds()
        ).decision();
    }

    public List<Reservation> getAllReservations() {
        return reservationRepository.findAll();
    }

    public Reservation validateReservation(Long id, String statusString, String adminId, String comment) {
        Reservation res = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Réservation introuvable"));

        ReservationStatus status;
        try {
            status = ReservationStatus.valueOf(statusString.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Statut invalide.");
        }

        if (status == ReservationStatus.REJECTED || status == ReservationStatus.MODIFICATION_REQUESTED) {
            if (comment == null || comment.trim().isEmpty()) {
                throw new IllegalArgumentException("Un motif est obligatoire pour un refus ou une demande de modification.");
            }
        }

        res.setStatus(status);
        res.setValidatedBy(adminId);
        res.setValidatedAt(LocalDateTime.now());
        res.setValidationComment(comment);

        return reservationRepository.save(res);
    }

    public void cancelReservation(Long id) {
        Reservation res = reservationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Réservation introuvable"));
        res.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(res);
    }

    private EvaluatedReservation evaluateReservation(
            LocalDateTime startTime,
            LocalDateTime endTime,
            Long roomId,
            List<Long> equipmentIds
    ) {
        if (roomId == null && (equipmentIds == null || equipmentIds.isEmpty())) {
            throw new IllegalArgumentException("Une réservation doit inclure au moins une salle ou un équipement.");
        }

        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("Les dates de début et de fin sont obligatoires.");
        }

        if (startTime.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("La date de début doit être dans le futur.");
        }

        if (!endTime.isAfter(startTime)) {
            throw new IllegalArgumentException("La date de fin doit être après la date de début.");
        }

        long durationMinutes = ChronoUnit.MINUTES.between(startTime, endTime);
        long durationHours = Math.max(1, (long) Math.ceil(durationMinutes / 60.0));
        if (durationHours > MAX_DURATION_HOURS) {
            throw new IllegalArgumentException("La durée maximale est de " + MAX_DURATION_HOURS + " heures.");
        }

        List<String> blockingReasons = new ArrayList<>();
        List<String> validationReasons = new ArrayList<>();
        List<String> informationNotes = new ArrayList<>();
        List<Equipment> resolvedEquipments = new ArrayList<>();
        Room resolvedRoom = null;

        if (roomId != null) {
            resolvedRoom = roomRepository.findById(roomId)
                    .orElseThrow(() -> new RuntimeException("Salle introuvable"));

            if (resolvedRoom.getStatus() != ResourceStatus.AVAILABLE) {
                blockingReasons.add("La salle est indisponible ou en maintenance.");
            }

            if (resolvedRoom.getCapacity() != null && resolvedRoom.getCapacity() >= LARGE_ROOM_VALIDATION_CAPACITY) {
                validationReasons.add("La salle dépasse le seuil de capacité et nécessite une validation admin.");
            }

            List<Reservation> roomConflicts = reservationRepository.findConflictingReservationsForRoom(
                    resolvedRoom.getId(),
                    startTime.minusMinutes(BUFFER_MINUTES_BEFORE),
                    endTime.plusMinutes(BUFFER_MINUTES_AFTER)
            );

            if (!roomConflicts.isEmpty()) {
                blockingReasons.add("La salle est déjà réservée sur ce créneau avec temps tampon inclus.");
            }
        }

        if (equipmentIds != null && !equipmentIds.isEmpty()) {
            for (Long equipmentId : equipmentIds) {
                Equipment equipment = equipmentRepository.findById(equipmentId)
                        .orElseThrow(() -> new RuntimeException("Équipement introuvable"));

                if (equipment.getStatus() != ResourceStatus.AVAILABLE) {
                    blockingReasons.add("L'équipement " + equipment.getName() + " est indisponible ou en maintenance.");
                }

                if (equipment.isSensitive()) {
                    validationReasons.add("L'équipement " + equipment.getName() + " est sensible.");
                }

                List<Reservation> equipmentConflicts = reservationRepository.findConflictingReservationsForEquipment(
                        equipment.getId(),
                        startTime.minusMinutes(BUFFER_MINUTES_BEFORE),
                        endTime.plusMinutes(BUFFER_MINUTES_AFTER)
                );

                if (!equipmentConflicts.isEmpty()) {
                    blockingReasons.add("L'équipement " + equipment.getName() + " est déjà réservé avec temps tampon inclus.");
                }

                resolvedEquipments.add(equipment);
            }
        }

        applyScheduleRules(startTime, endTime, durationMinutes, validationReasons);
        applyCalendarBlocks(startTime, endTime, blockingReasons);
        informationNotes.add("Temps tampon appliqué: " + BUFFER_MINUTES_BEFORE + " min avant et " + BUFFER_MINUTES_AFTER + " min après.");

        boolean blocked = !blockingReasons.isEmpty();
        boolean requiresValidation = !blocked && !validationReasons.isEmpty();
        boolean autoApproved = !blocked && !requiresValidation;

        ReservationRuleDecisionResponse decision = ReservationRuleDecisionResponse.builder()
                .blocked(blocked)
                .requiresValidation(requiresValidation)
                .autoApproved(autoApproved)
                .finalStatus(blocked ? null : (requiresValidation ? ReservationStatus.PENDING : ReservationStatus.APPROVED))
                .durationHours((int) durationHours)
                .bufferMinutesBefore(BUFFER_MINUTES_BEFORE)
                .bufferMinutesAfter(BUFFER_MINUTES_AFTER)
                .longDurationThresholdHours(LONG_DURATION_VALIDATION_THRESHOLD_HOURS)
                .maxDurationHours(MAX_DURATION_HOURS)
                .blockingReasons(blockingReasons)
                .validationReasons(validationReasons)
                .informationNotes(informationNotes)
                .build();

        return new EvaluatedReservation(decision, resolvedRoom, resolvedEquipments);
    }

    private void applyScheduleRules(
            LocalDateTime startTime,
            LocalDateTime endTime,
            long durationMinutes,
            List<String> validationReasons
    ) {
        DayOfWeek day = startTime.getDayOfWeek();
        boolean outsideBusinessHours =
                startTime.getHour() < BUSINESS_HOUR_START ||
                endTime.getHour() >= BUSINESS_HOUR_END ||
                day == DayOfWeek.SATURDAY ||
                day == DayOfWeek.SUNDAY;

        if (outsideBusinessHours) {
            validationReasons.add("Le créneau demandé est hors horaires standards.");
        }

        if (durationMinutes > LONG_DURATION_VALIDATION_THRESHOLD_HOURS * 60L) {
            validationReasons.add("La durée dépasse " + LONG_DURATION_VALIDATION_THRESHOLD_HOURS + " heures.");
        }
    }

    private void applyCalendarBlocks(
            LocalDateTime startTime,
            LocalDateTime endTime,
            List<String> blockingReasons
    ) {
        List<ReservationBlockPeriod> overlappingPeriods =
                reservationBlockPeriodRepository.findActiveOverlappingPeriods(startTime, endTime);

        for (ReservationBlockPeriod period : overlappingPeriods) {
            blockingReasons.add("Période bloquée: " + period.getTitle() + " (" + period.getType() + ").");
        }
    }

    private List<Long> extractEquipmentIds(List<Equipment> equipments) {
        if (equipments == null || equipments.isEmpty()) {
            return Collections.emptyList();
        }

        return equipments.stream()
                .map(Equipment::getId)
                .toList();
    }

    private record EvaluatedReservation(
            ReservationRuleDecisionResponse decision,
            Room room,
            List<Equipment> equipments
    ) {
    }
}
