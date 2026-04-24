package com.example.reservation.Services;

import com.example.reservation.Entities.Room;
import com.example.reservation.Entities.Enums.ResourceStatus;
import com.example.reservation.Repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RoomService {
    private final RoomRepository roomRepository;

    public record DeleteRoomResult(boolean deleted, Room room, String message) {}

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
        }).orElseThrow(() -> new RuntimeException("Room not found"));
    }

    public DeleteRoomResult deleteRoom(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        try {
            roomRepository.delete(room);
            return new DeleteRoomResult(true, null, "Room deleted successfully.");
        } catch (DataIntegrityViolationException e) {
            room.setStatus(ResourceStatus.UNAVAILABLE);
            Room updatedRoom = roomRepository.save(room);
            return new DeleteRoomResult(
                    false,
                    updatedRoom,
                    "This room is linked to reservation history, so it was kept and marked as Unavailable."
            );
        }
    }
}
