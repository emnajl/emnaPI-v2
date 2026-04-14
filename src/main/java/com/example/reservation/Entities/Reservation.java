package com.example.reservation.Entities;

import com.example.reservation.Entities.Enums.ReservationStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Data
@NoArgsConstructor
public class Reservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status = ReservationStatus.PENDING;

    // Champs originaux
    @Column(length = 1000)
    private String rejectionReason;

    @Column(nullable = false)
    private String userId;

    // Nouveaux champs de traçabilité
    private String validatedBy;
    private LocalDateTime validatedAt;
    
    @Column(length = 1000)
    private String validationComment;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "reservation_equipment",
        joinColumns = @JoinColumn(name = "reservation_id"),
        inverseJoinColumns = @JoinColumn(name = "equipment_id")
    )
    private List<Equipment> equipments;
}
