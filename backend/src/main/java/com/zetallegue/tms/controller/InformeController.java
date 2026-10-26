package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.InformeRequestDTO;
import com.zetallegue.tms.dto.InformeResultDTO;
import com.zetallegue.tms.service.InformeService;
import com.lowagie.text.DocumentException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/informes")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class InformeController {

    private final InformeService informeService;

    @PostMapping(value = "/generar", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public void generar(@RequestBody InformeRequestDTO request, HttpServletResponse response) throws IOException {
        try {
            InformeResultDTO result = informeService.generarInforme(request);
            byte[] bytes = result.getContenido();
            String filename = result.getNombreArchivo() != null && !result.getNombreArchivo().isEmpty()
                    ? result.getNombreArchivo() : "informe_retirados.zip";
            boolean esZip = filename.toLowerCase().endsWith(".zip");
            String contentType = esZip ? "application/zip" : (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType(contentType);
            response.setContentLength(bytes.length);
            response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encoded);
            response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
            response.getOutputStream().write(bytes);
            response.getOutputStream().flush();
        } catch (IllegalArgumentException e) {
            log.warn("Solicitud de informe inválida: {}", e.getMessage());
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (DocumentException | IOException e) {
            log.error("Error generando informe", e);
            if (!response.isCommitted()) {
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            }
        }
    }
}
