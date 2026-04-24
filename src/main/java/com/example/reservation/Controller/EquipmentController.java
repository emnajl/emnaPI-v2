package com.example.reservation.Controller;

import com.example.reservation.Entities.Equipment;
import com.example.reservation.Services.EquipmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/equipments")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class EquipmentController {
    private final EquipmentService equipmentService;

    @PostMapping
    public ResponseEntity<Equipment> createEquipment(@RequestBody Equipment equipment) {
        return ResponseEntity.ok(equipmentService.createEquipment(equipment));
    }

    @GetMapping
    public ResponseEntity<List<Equipment>> getAllEquipments() {
        return ResponseEntity.ok(equipmentService.getAllEquipments());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Equipment> getEquipmentById(@PathVariable Long id) {
        return equipmentService.getEquipmentById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Equipment> updateEquipment(@PathVariable Long id, @RequestBody Equipment equipmentDetails) {
        try {
            return ResponseEntity.ok(equipmentService.updateEquipment(id, equipmentDetails));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<EquipmentService.DeleteEquipmentResult> deleteEquipment(@PathVariable Long id) {
        return ResponseEntity.ok(equipmentService.deleteEquipment(id));
    }
}
