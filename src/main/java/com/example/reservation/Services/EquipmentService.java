package com.example.reservation.Services;

import com.example.reservation.Entities.Equipment;
import com.example.reservation.Entities.Enums.ResourceStatus;
import com.example.reservation.Repository.EquipmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EquipmentService {
    private final EquipmentRepository equipmentRepository;

    public record DeleteEquipmentResult(boolean deleted, Equipment equipment, String message) {}

    public Equipment createEquipment(Equipment equipment) {
        return equipmentRepository.save(equipment);
    }

    public List<Equipment> getAllEquipments() {
        return equipmentRepository.findAll();
    }

    public Optional<Equipment> getEquipmentById(Long id) {
        return equipmentRepository.findById(id);
    }

    public Equipment updateEquipment(Long id, Equipment equipmentDetails) {
        return equipmentRepository.findById(id).map(equipment -> {
            equipment.setName(equipmentDetails.getName());
            equipment.setType(equipmentDetails.getType());
            equipment.setReference(equipmentDetails.getReference());
            equipment.setStatus(equipmentDetails.getStatus());
            equipment.setSensitive(equipmentDetails.isSensitive());
            return equipmentRepository.save(equipment);
        }).orElseThrow(() -> new RuntimeException("Equipment not found"));
    }

    public DeleteEquipmentResult deleteEquipment(Long id) {
        Equipment equipment = equipmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Equipment not found"));

        try {
            equipmentRepository.delete(equipment);
            return new DeleteEquipmentResult(true, null, "Equipment deleted successfully.");
        } catch (DataIntegrityViolationException e) {
            equipment.setStatus(ResourceStatus.UNAVAILABLE);
            Equipment updatedEquipment = equipmentRepository.save(equipment);
            return new DeleteEquipmentResult(
                    false,
                    updatedEquipment,
                    "This equipment is linked to reservation history, so it was kept and marked as Unavailable."
            );
        }
    }
}
