package com.example.reservation.Services;

import com.example.reservation.Entities.Equipment;
import com.example.reservation.Entities.Reservation;
import com.example.reservation.Entities.Room;
import com.example.reservation.Entities.Enums.ReservationStatus;
import com.example.reservation.Entities.Enums.ResourceStatus;
import com.example.reservation.Repository.EquipmentRepository;
import com.example.reservation.Repository.ReservationRepository;
import com.example.reservation.Repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReservationService {
    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final EquipmentRepository equipmentRepository;

    private static final int MAX_DURATION_HOURS = 8;

    @Transactional
    public Reservation createReservation(Reservation reservationRequest) {
        if (reservationRequest.getRoom() == null && (reservationRequest.getEquipments() == null || reservationRequest.getEquipments().isEmpty())) {
            throw new IllegalArgumentException("Une réservation doit inclure au moins une salle ou un équipement.");
        }

        // 1. Validation des dates
        if (reservationRequest.getStartTime().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("La date de début doit être dans le futur.");
        }
        if (!reservationRequest.getEndTime().isAfter(reservationRequest.getStartTime())) {
            throw new IllegalArgumentException("La date de fin doit être après la date de début.");
        }

        // 2. Limite de durée
        long duration = ChronoUnit.HOURS.between(reservationRequest.getStartTime(), reservationRequest.getEndTime());
        if (duration > MAX_DURATION_HOURS) {
            throw new IllegalArgumentException("La durée maximale est de " + MAX_DURATION_HOURS + " heures.");
        }

        boolean requiresValidation = false;

        // 3. Validation de la Salle
        if (reservationRequest.getRoom() != null) {
            Room room = roomRepository.findById(reservationRequest.getRoom().getId())
                    .orElseThrow(() -> new RuntimeException("Salle introuvable"));
            if (room.getStatus() != ResourceStatus.AVAILABLE) {
                throw new IllegalArgumentException("La salle n'est pas disponible pour réservation.");
            }
            List<Reservation> conflicts = reservationRepository.findConflictingReservationsForRoom(
                    room.getId(), reservationRequest.getStartTime(), reservationRequest.getEndTime()
            );
            if (!conflicts.isEmpty()) {
                throw new IllegalArgumentException("La salle est déjà réservée sur ce créneau.");
            }
            reservationRequest.setRoom(room);
            
            // Règle auto-approbation
            if (room.getCapacity() != null && room.getCapacity() >= 20) {
                requiresValidation = true;
            }
        }

        // 4. Validation des Équipements
        if (reservationRequest.getEquipments() != null && !reservationRequest.getEquipments().isEmpty()) {
            for (Equipment eqReq : reservationRequest.getEquipments()) {
                Equipment eq = equipmentRepository.findById(eqReq.getId())
                        .orElseThrow(() -> new RuntimeException("Équipement introuvable"));
                if (eq.getStatus() != ResourceStatus.AVAILABLE) {
                    throw new IllegalArgumentException("L'équipement " + eq.getName() + " n'est pas disponible.");
                }
                List<Reservation> conflicts = reservationRepository.findConflictingReservationsForEquipment(
                        eq.getId(), reservationRequest.getStartTime(), reservationRequest.getEndTime()
                );
                if (!conflicts.isEmpty()) {
                    throw new IllegalArgumentException("L'équipement " + eq.getName() + " est déjà réservé sur ce créneau.");
                }
                if (eq.isSensitive()) {
                    requiresValidation = true;
                }
            }
        }

        // 5. Horaires normaux
        int startHour = reservationRequest.getStartTime().getHour();
        int endHour = reservationRequest.getEndTime().getHour();
        java.time.DayOfWeek day = reservationRequest.getStartTime().getDayOfWeek();
        if (startHour < 8 || endHour >= 18 || day == java.time.DayOfWeek.SATURDAY || day == java.time.DayOfWeek.SUNDAY) {
            requiresValidation = true;
        }

        // Statut final de la demande
        reservationRequest.setStatus(requiresValidation ? ReservationStatus.PENDING : ReservationStatus.APPROVED);

        return reservationRepository.save(reservationRequest);
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
}
