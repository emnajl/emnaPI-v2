package com.example.reservation.Services;

import com.example.reservation.Entities.Room;
import com.example.reservation.Repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RoomService {
    private final RoomRepository roomRepository;

    public Room createRoom(Room room) {
        return roomRepository.save(room);
    }

    public List<Room> getAllRooms() {
        return roomRepository.findAll();
    }

    public Optional<Room> getRoomById(Long id) {
        return roomRepository.findById(id);
    }

    public Room updateRoom(Long id, Room roomDetails) {
        return roomRepository.findById(id).map(room -> {
            room.setName(roomDetails.getName());
            room.setCapacity(roomDetails.getCapacity());
            room.setLocation(roomDetails.getLocation());
            room.setStatus(roomDetails.getStatus());
            return roomRepository.save(room);
        }).orElseThrow(() -> new RuntimeException("Salle non trouvée"));
    }

    public void deleteRoom(Long id) {
        try {
            roomRepository.deleteById(id);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Soft delete
            Room room = roomRepository.findById(id).orElseThrow();
            room.setStatus(com.example.reservation.Entities.Enums.ResourceStatus.UNAVAILABLE);
            roomRepository.save(room);
            throw new RuntimeException("La salle contient des historiques de réservation. Elle a été basculée en Indisponible.");
        }
    }
}
