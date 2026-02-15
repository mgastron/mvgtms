package com.zetallegue.tms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "envios", indexes = {
    @Index(name = "idx_tracking", columnList = "tracking"),
    @Index(name = "idx_cliente", columnList = "cliente"),
    @Index(name = "idx_fecha", columnList = "fecha"),
    @Index(name = "idx_fecha_venta", columnList = "fecha_venta"),
    @Index(name = "idx_fecha_llegue", columnList = "fecha_llegue"),
    @Index(name = "idx_estado", columnList = "estado"),
    @Index(name = "idx_origen", columnList = "origen"),
    @Index(name = "idx_zona_entrega", columnList = "zona_entrega"),
    @Index(name = "idx_eliminado", columnList = "eliminado"),
    @Index(name = "idx_fecha_eliminado", columnList = "fecha, eliminado"),
    @Index(name = "idx_colectado", columnList = "colectado")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Envio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha; // Fecha de carga

    @Column(name = "fecha_venta")
    private LocalDateTime fechaVenta;

    @Column(name = "fecha_llegue")
    private LocalDateTime fechaLlegue;

    @Column(name = "fecha_entregado")
    private LocalDateTime fechaEntregado;

    @Column(name = "fecha_asignacion")
    private LocalDateTime fechaAsignacion;

    @Column(name = "fecha_despacho")
    private LocalDateTime fechaDespacho;

    @Column(name = "fecha_colecta")
    private LocalDateTime fechaColecta;

    @Column(name = "fecha_a_planta")
    private LocalDateTime fechaAPlanta;

    @Column(name = "fecha_cancelado")
    private LocalDateTime fechaCancelado;

    @Column(name = "fecha_ultimo_movimiento")
    private LocalDateTime fechaUltimoMovimiento;

    @Column(name = "origen", length = 50)
    private String origen;

    @Column(name = "tracking", length = 100)
    private String tracking;

    @Column(name = "cliente", length = 200)
    private String cliente;

    @Column(name = "direccion", length = 500)
    private String direccion;

    @Column(name = "nombre_destinatario", length = 200)
    private String nombreDestinatario;

    @Column(name = "telefono", length = 50)
    private String telefono;

    @Column(name = "email", length = 200)
    private String email;

    @Column(name = "impreso", length = 10)
    private String impreso = "NO";

    @Column(name = "observaciones", length = 1000)
    private String observaciones;

    @Column(name = "total_a_cobrar", length = 50)
    private String totalACobrar;

    @Column(name = "cambio_retiro", length = 200)
    private String cambioRetiro;

    @Column(name = "localidad", length = 200)
    private String localidad;

    @Column(name = "codigo_postal", length = 20)
    private String codigoPostal;

    @Column(name = "zona_entrega", length = 50)
    private String zonaEntrega;

    @Column(name = "qr_data", length = 500)
    private String qrData;

    @Column(name = "estado", length = 100)
    private String estado = "A retirar";

    @Column(name = "eliminado", nullable = false)
    private Boolean eliminado = false;

    @Column(name = "chofer_asignado_id")
    private Long choferAsignadoId;

    @Column(name = "chofer_asignado_nombre", length = 200)
    private String choferAsignadoNombre;

    // Datos de entrega
    @Column(name = "rol_recibio", length = 100)
    private String rolRecibio;

    @Column(name = "nombre_recibio", length = 200)
    private String nombreRecibio;

    @Column(name = "dni_recibio", length = 50)
    private String dniRecibio;

    // Campo para indicar si el envío fue colectado (escaneado) por Zeta Llegue
    // Los envíos Flex se sincronizan con colectado=false y solo aparecen en las vistas cuando se escanean
    // NOTA: nullable=true permite que H2 agregue la columna sin problemas a tablas existentes
    @Column(name = "colectado", nullable = true)
    private Boolean colectado = false;

    // Costo de envío calculado desde la lista de precios del cliente
    @Column(name = "costo_envio", length = 50)
    private String costoEnvio;

    // IDML (Order ID de MercadoLibre)
    @Column(name = "idml", length = 50)
    private String idml;

    // Peso del paquete
    @Column(name = "peso", length = 50)
    private String peso;

    // Método de envío
    @Column(name = "metodo_envio", length = 200)
    private String metodoEnvio;

    // Deadline: mismo día a las 23:00 si venta antes de las 15:00, o día siguiente a las 23:00 si después
    @Column(name = "deadline")
    private LocalDateTime deadline;

    // ID del shipment en MercadoLibre (para polling de estados)
    @Column(name = "ml_shipment_id", length = 50)
    private String mlShipmentId;

    // Token único para el link público de tracking
    @Column(name = "tracking_token", length = 100, unique = true)
    private String trackingToken;
}

