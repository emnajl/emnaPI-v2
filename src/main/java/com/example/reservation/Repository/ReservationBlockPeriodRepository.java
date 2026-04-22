package com.example.reservation.Repository;

import com.example.reservation.Entities.ReservationBlockPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationBlockPeriodRepository extends JpaRepository<ReservationBlockPeriod, Long> {
    @Query("SELECT p FROM ReservationBlockPeriod p " +
           "WHERE p.active = true AND p.startTime < :endTime AND p.endTime > :startTime")
    List<ReservationBlockPeriod> findActiveOverlappingPeriods(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
