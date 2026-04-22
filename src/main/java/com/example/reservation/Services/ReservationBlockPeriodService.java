package com.example.reservation.Services;

import com.example.reservation.Entities.ReservationBlockPeriod;
import com.example.reservation.Repository.ReservationBlockPeriodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReservationBlockPeriodService {
    private final ReservationBlockPeriodRepository reservationBlockPeriodRepository;

    public List<ReservationBlockPeriod> getAllPeriods() {
        return reservationBlockPeriodRepository.findAll();
    }

    public ReservationBlockPeriod createPeriod(ReservationBlockPeriod period) {
        return reservationBlockPeriodRepository.save(period);
    }

    public ReservationBlockPeriod updatePeriod(Long id, ReservationBlockPeriod request) {
        ReservationBlockPeriod existing = reservationBlockPeriodRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Période bloquée introuvable"));

        existing.setTitle(request.getTitle());
        existing.setType(request.getType());
        existing.setStartTime(request.getStartTime());
        existing.setEndTime(request.getEndTime());
        existing.setDescription(request.getDescription());
        existing.setActive(request.isActive());

        return reservationBlockPeriodRepository.save(existing);
    }

    public void deletePeriod(Long id) {
        reservationBlockPeriodRepository.deleteById(id);
    }
}
