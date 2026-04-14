package com.example.reservation.Controller;

import com.example.reservation.Entities.Reservation;
import com.example.reservation.Services.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class ReservationController {
    private final ReservationService reservationService;

    @PostMapping
    public ResponseEntity<Reservation> createReservation(@RequestBody Reservation reservation) {
        return ResponseEntity.ok(reservationService.createReservation(reservation));
    }

    @GetMapping
    public ResponseEntity<List<Reservation>> getAllReservations() {
        return ResponseEntity.ok(reservationService.getAllReservations());
    }

    @PutMapping("/{id}/validate")
    public ResponseEntity<Reservation> validateReservation(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        
        String status = payload.get("status");
        String adminId = payload.get("adminId");
        String comment = payload.get("comment");
        
        return ResponseEntity.ok(reservationService.validateReservation(id, status, adminId, comment));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelReservation(@PathVariable Long id) {
        reservationService.cancelReservation(id);
        return ResponseEntity.ok().build();
    }
}
