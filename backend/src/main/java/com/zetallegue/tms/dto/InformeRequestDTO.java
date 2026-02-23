package com.zetallegue.tms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Solicitud de informe de pedidos colectados.
 * - Pedidos colectados = envíos con fechaColecta en el rango [fechaDesde, fechaHasta].
 * - tipoDestinatario: GRUPOS, CUENTAS, TODOS_GRUPOS, TODAS_CUENTAS.
 * - Si GRUPOS/CUENTAS se usan idsGrupos o idsCuentas (IDs de grupo o de cliente).
 * - formato: EXCEL o PDF.
 * - tomarEnvios: SOLO_ENTREGADOS o RETIRADOS_EXCEPTO_RECHAZADOS_CANCELADOS.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InformeRequestDTO {

    private LocalDate fechaDesde;
    private LocalDate fechaHasta;
    /** GRUPOS, CUENTAS, TODOS_GRUPOS, TODAS_CUENTAS */
    private String tipoDestinatario;
    /** IDs de grupos cuando tipoDestinatario = GRUPOS */
    private List<Long> idsGrupos;
    /** IDs de clientes (cuentas) cuando tipoDestinatario = CUENTAS */
    private List<Long> idsCuentas;
    /** EXCEL o PDF */
    private String formato;
    /** SOLO_ENTREGADOS o RETIRADOS_EXCEPTO_RECHAZADOS_CANCELADOS */
    private String tomarEnvios;
}
