package com.example.reservation.Services;

import com.example.reservation.Entities.Equipment;
import com.example.reservation.Repository.EquipmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class EquipmentService {
    private final EquipmentRepository equipmentRepository;

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
            equipment.setSensitive(equipmentDetails.isSensitive()); // Important pour l'update
            return equipmentRepository.save(equipment);
        }).orElseThrow(() -> new RuntimeException("Équipement non trouvé"));
    }

    public void deleteEquipment(Long id) {
        try {
            equipmentRepository.deleteById(id);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Soft delete en cas de conflit de clé étrangère
            Equipment eq = equipmentRepository.findById(id).orElseThrow();
            eq.setStatus(com.example.reservation.Entities.Enums.ResourceStatus.UNAVAILABLE);
            equipmentRepository.save(eq);
            throw new RuntimeException("L'équipement est lié à des réservations passées. Il a été désactivé (Statut Indisponible) au lieu d'être supprimé.");
        }
    }
}
