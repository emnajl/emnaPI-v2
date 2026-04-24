import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = 'http://localhost:8087/api';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) {}

  createRoom(room: any): Observable<any> {
    return this.http.post(`${API_URL}/rooms`, room);
  }

  updateRoom(id: number, room: any): Observable<any> {
    return this.http.put(`${API_URL}/rooms/${id}`, room);
  }

  deleteRoom(id: number): Observable<any> {
    return this.http.delete(`${API_URL}/rooms/${id}`);
  }

  createEquipment(eq: any): Observable<any> {
    return this.http.post(`${API_URL}/equipments`, eq);
  }

  updateEquipment(id: number, eq: any): Observable<any> {
    return this.http.put(`${API_URL}/equipments/${id}`, eq);
  }

  deleteEquipment(id: number): Observable<any> {
    return this.http.delete(`${API_URL}/equipments/${id}`);
  }

  getRooms(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/rooms`);
  }

  getEquipments(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/equipments`);
  }

  getReservations(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/reservations`);
  }

  createReservation(reservation: any): Observable<any> {
    return this.http.post(`${API_URL}/reservations`, reservation);
  }

  previewReservationRules(payload: any): Observable<any> {
    return this.http.post(`${API_URL}/reservations/preview`, payload);
  }

  askReservationAssistant(prompt: string): Observable<any> {
    return this.http.post(`${API_URL}/ai/reservation-assistant`, { prompt });
  }

  cancelReservation(id: number): Observable<any> {
    return this.http.put(`${API_URL}/reservations/${id}/cancel`, {});
  }

  validateReservation(id: number, status: string, adminId: string, comment?: string): Observable<any> {
    const payload = { status, adminId, comment: comment || '' };
    return this.http.put(`${API_URL}/reservations/${id}/validate`, payload);
  }
}
