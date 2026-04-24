package com.example.reservation.Controller;

import com.example.reservation.Dto.AiReservationAssistantRequest;
import com.example.reservation.Dto.AiReservationAssistantResponse;
import com.example.reservation.Services.AiReservationAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class AiReservationAssistantController {
    private final AiReservationAssistantService aiReservationAssistantService;

    @PostMapping("/reservation-assistant")
    public ResponseEntity<AiReservationAssistantResponse> recommendReservation(
            @RequestBody AiReservationAssistantRequest request) {
        return ResponseEntity.ok(aiReservationAssistantService.recommend(request.getPrompt()));
    }
}
