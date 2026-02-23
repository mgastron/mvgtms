package com.zetallegue.tms.controller;

import com.zetallegue.tms.dto.InformeRequestDTO;
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
            byte[] bytes = informeService.generarInforme(request);
            String formato = request.getFormato() != null ? request.getFormato().toUpperCase() : "EXCEL";
            boolean esZip = bytes.length > 4 && bytes[0] == 0x50 && bytes[1] == 0x4B && bytes[2] == 0x03 && bytes[3] == 0x04;
            String contentType = esZip ? "application/zip" : ("PDF".equals(formato) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            String ext = esZip ? "zip" : ("PDF".equals(formato) ? "pdf" : "xlsx");
            String filename = "informe_colectados." + ext;
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
