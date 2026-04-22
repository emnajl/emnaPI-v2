package com.example.reservation.Dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ReservationRulePreviewRequest {
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long roomId;
    private List<Long> equipmentIds;
    private String userId;
}
