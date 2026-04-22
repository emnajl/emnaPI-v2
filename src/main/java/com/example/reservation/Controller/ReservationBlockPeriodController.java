package com.example.reservation.Controller;

import com.example.reservation.Entities.ReservationBlockPeriod;
import com.example.reservation.Services.ReservationBlockPeriodService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reservation-block-periods")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class ReservationBlockPeriodController {
    private final ReservationBlockPeriodService reservationBlockPeriodService;

    @GetMapping
    public ResponseEntity<List<ReservationBlockPeriod>> getAllPeriods() {
        return ResponseEntity.ok(reservationBlockPeriodService.getAllPeriods());
    }

    @PostMapping
    public ResponseEntity<ReservationBlockPeriod> createPeriod(@RequestBody ReservationBlockPeriod period) {
        return ResponseEntity.ok(reservationBlockPeriodService.createPeriod(period));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReservationBlockPeriod> updatePeriod(
            @PathVariable Long id,
            @RequestBody ReservationBlockPeriod period) {
        return ResponseEntity.ok(reservationBlockPeriodService.updatePeriod(id, period));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePeriod(@PathVariable Long id) {
        reservationBlockPeriodService.deletePeriod(id);
        return ResponseEntity.noContent().build();
    }
}
