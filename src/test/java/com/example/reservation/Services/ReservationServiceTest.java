package com.example.reservation.Services;

import com.example.reservation.Dto.ReservationRuleDecisionResponse;
import com.example.reservation.Dto.ReservationRulePreviewRequest;
import com.example.reservation.Entities.Equipment;
import com.example.reservation.Entities.Enums.ReservationBlockType;
import com.example.reservation.Entities.Enums.ReservationStatus;
import com.example.reservation.Entities.Enums.ResourceStatus;
import com.example.reservation.Entities.Reservation;
import com.example.reservation.Entities.ReservationBlockPeriod;
import com.example.reservation.Entities.Room;
import com.example.reservation.Repository.EquipmentRepository;
import com.example.reservation.Repository.ReservationBlockPeriodRepository;
import com.example.reservation.Repository.ReservationRepository;
import com.example.reservation.Repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock
    private ReservationRepository reservationRepository;

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private EquipmentRepository equipmentRepository;

    @Mock
    private ReservationBlockPeriodRepository reservationBlockPeriodRepository;

    @InjectMocks
    private ReservationService reservationService;

    private Room smallRoom;
    private Room largeRoom;
    private Equipment normalEquipment;
    private Equipment sensitiveEquipment;

    @BeforeEach
    void setUp() {
        smallRoom = new Room();
        smallRoom.setId(1L);
        smallRoom.setName("Salle A");
        smallRoom.setCapacity(12);
        smallRoom.setStatus(ResourceStatus.AVAILABLE);

        largeRoom = new Room();
        largeRoom.setId(2L);
        largeRoom.setName("Amphi");
        largeRoom.setCapacity(40);
        largeRoom.setStatus(ResourceStatus.AVAILABLE);

        normalEquipment = new Equipment();
        normalEquipment.setId(1L);
        normalEquipment.setName("Projecteur");
        normalEquipment.setStatus(ResourceStatus.AVAILABLE);
        normalEquipment.setSensitive(false);

        sensitiveEquipment = new Equipment();
        sensitiveEquipment.setId(2L);
        sensitiveEquipment.setName("Caméra");
        sensitiveEquipment.setStatus(ResourceStatus.AVAILABLE);
        sensitiveEquipment.setSensitive(true);
    }

    @Test
    void shouldAutoApproveSmallRoomDuringBusinessHours() {
        LocalDateTime start = LocalDateTime.of(2030, 4, 15, 10, 0);
        LocalDateTime end = LocalDateTime.of(2030, 4, 15, 12, 0);

        when(roomRepository.findById(1L)).thenReturn(Optional.of(smallRoom));
        when(reservationRepository.findConflictingReservationsForRoom(any(), any(), any())).thenReturn(List.of());
        when(reservationBlockPeriodRepository.findActiveOverlappingPeriods(any(), any())).thenReturn(List.of());

        ReservationRulePreviewRequest request = new ReservationRulePreviewRequest();
        request.setStartTime(start);
        request.setEndTime(end);
        request.setRoomId(1L);

        ReservationRuleDecisionResponse response = reservationService.previewReservationRules(request);

        assertTrue(response.isAutoApproved());
        assertFalse(response.isRequiresValidation());
        assertFalse(response.isBlocked());
        assertEquals(ReservationStatus.APPROVED, response.getFinalStatus());
    }

    @Test
    void shouldRequireValidationForLargeRoomAndSensitiveEquipment() {
        LocalDateTime start = LocalDateTime.of(2030, 4, 15, 10, 0);
        LocalDateTime end = LocalDateTime.of(2030, 4, 15, 15, 0);

        when(roomRepository.findById(2L)).thenReturn(Optional.of(largeRoom));
        when(equipmentRepository.findById(2L)).thenReturn(Optional.of(sensitiveEquipment));
        when(reservationRepository.findConflictingReservationsForRoom(any(), any(), any())).thenReturn(List.of());
        when(reservationRepository.findConflictingReservationsForEquipment(any(), any(), any())).thenReturn(List.of());
        when(reservationBlockPeriodRepository.findActiveOverlappingPeriods(any(), any())).thenReturn(List.of());

        ReservationRulePreviewRequest request = new ReservationRulePreviewRequest();
        request.setStartTime(start);
        request.setEndTime(end);
        request.setRoomId(2L);
        request.setEquipmentIds(List.of(2L));

        ReservationRuleDecisionResponse response = reservationService.previewReservationRules(request);

        assertFalse(response.isBlocked());
        assertTrue(response.isRequiresValidation());
        assertEquals(ReservationStatus.PENDING, response.getFinalStatus());
        assertTrue(response.getValidationReasons().size() >= 2);
    }

    @Test
    void shouldBlockReservationDuringBlockedPeriod() {
        LocalDateTime start = LocalDateTime.of(2030, 5, 1, 10, 0);
        LocalDateTime end = LocalDateTime.of(2030, 5, 1, 12, 0);

        ReservationBlockPeriod blockedPeriod = new ReservationBlockPeriod();
        blockedPeriod.setTitle("Jour férié");
        blockedPeriod.setType(ReservationBlockType.HOLIDAY);
        blockedPeriod.setStartTime(LocalDateTime.of(2030, 5, 1, 0, 0));
        blockedPeriod.setEndTime(LocalDateTime.of(2030, 5, 1, 23, 59));

        when(roomRepository.findById(1L)).thenReturn(Optional.of(smallRoom));
        when(reservationRepository.findConflictingReservationsForRoom(any(), any(), any())).thenReturn(List.of());
        when(reservationBlockPeriodRepository.findActiveOverlappingPeriods(any(), any()))
                .thenReturn(List.of(blockedPeriod));

        Reservation reservation = new Reservation();
        reservation.setStartTime(start);
        reservation.setEndTime(end);
        reservation.setRoom(smallRoom);
        reservation.setUserId("user-1");

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> reservationService.createReservation(reservation)
        );

        assertTrue(exception.getMessage().contains("Période bloquée"));
    }

    @Test
    void shouldBlockReservationWhenBufferConflictExists() {
        LocalDateTime start = LocalDateTime.of(2030, 4, 15, 10, 0);
        LocalDateTime end = LocalDateTime.of(2030, 4, 15, 11, 0);

        Reservation existingReservation = new Reservation();
        existingReservation.setId(99L);

        when(roomRepository.findById(1L)).thenReturn(Optional.of(smallRoom));
        when(reservationRepository.findConflictingReservationsForRoom(any(), any(), any()))
                .thenReturn(List.of(existingReservation));
        when(reservationBlockPeriodRepository.findActiveOverlappingPeriods(any(), any())).thenReturn(List.of());

        ReservationRulePreviewRequest request = new ReservationRulePreviewRequest();
        request.setStartTime(start);
        request.setEndTime(end);
        request.setRoomId(1L);

        ReservationRuleDecisionResponse response = reservationService.previewReservationRules(request);

        assertTrue(response.isBlocked());
        assertTrue(response.getBlockingReasons().get(0).contains("temps tampon"));
    }
}
