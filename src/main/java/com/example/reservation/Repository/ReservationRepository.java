package com.example.reservation.Repository;

import com.example.reservation.Entities.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @Query("SELECT r FROM Reservation r WHERE r.room.id = :roomId " +
           "AND r.status IN ('APPROVED', 'PENDING') " +
           "AND r.startTime < :endTime AND r.endTime > :startTime")
    List<Reservation> findConflictingReservationsForRoom(
            @Param("roomId") Long roomId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    @Query("SELECT r FROM Reservation r JOIN r.equipments e WHERE e.id = :equipmentId " +
           "AND r.status IN ('APPROVED', 'PENDING') " +
           "AND r.startTime < :endTime AND r.endTime > :startTime")
    List<Reservation> findConflictingReservationsForEquipment(
            @Param("equipmentId") Long equipmentId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
