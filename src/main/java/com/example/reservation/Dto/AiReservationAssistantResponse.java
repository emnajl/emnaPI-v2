package com.example.reservation.Dto;

import com.example.reservation.Entities.Enums.ReservationStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class AiReservationAssistantResponse {
    private Long roomId;
    private String roomName;
    private Integer requestedCapacity;

    private Long equipmentId;
    private String equipmentName;

    private LocalDateTime suggestedStartTime;
    private LocalDateTime suggestedEndTime;

    private ReservationStatus expectedStatus;
    private int confidence;
    private String summary;

    @Builder.Default
    private List<String> extractedNeeds = new ArrayList<>();

    @Builder.Default
    private List<String> reasons = new ArrayList<>();

    @Builder.Default
    private List<String> warnings = new ArrayList<>();
}
