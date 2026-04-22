package com.example.reservation.Dto;

import com.example.reservation.Entities.Enums.ReservationStatus;
import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class ReservationRuleDecisionResponse {
    @Builder.Default
    private boolean blocked = false;

    @Builder.Default
    private boolean requiresValidation = false;

    @Builder.Default
    private boolean autoApproved = false;

    private ReservationStatus finalStatus;
    private Integer durationHours;
    private Integer bufferMinutesBefore;
    private Integer bufferMinutesAfter;
    private Integer longDurationThresholdHours;
    private Integer maxDurationHours;

    @Builder.Default
    private List<String> blockingReasons = new ArrayList<>();

    @Builder.Default
    private List<String> validationReasons = new ArrayList<>();

    @Builder.Default
    private List<String> informationNotes = new ArrayList<>();
}
