package com.zetallegue.tms.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Value("${frontend.base.url:}")
    private String frontendBaseUrl;

    /**
     * Envía un email de notificación de envío al destinatario
     * @param destinatarioEmail Email del destinatario
     * @param nombreDestinatario Nombre del destinatario
     * @param tracking Número de tracking del envío
     * @param trackingToken Token único para el link de tracking público
     */
    public void enviarEmailNotificacionEnvio(String destinatarioEmail, String nombreDestinatario, String tracking, String trackingToken) {
        if (destinatarioEmail == null || destinatarioEmail.trim().isEmpty()) {
            log.warn("No se puede enviar email: el destinatario no tiene email configurado");
            return;
        }

        if (fromEmail == null || fromEmail.trim().isEmpty()) {
            log.warn("No se puede enviar email: no hay email remitente configurado en spring.mail.username");
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(destinatarioEmail);
            message.setSubject("Tu pedido está en camino - Zeta Llegué");

            // Construir el cuerpo del mensaje
            String nombre = nombreDestinatario != null && !nombreDestinatario.trim().isEmpty() 
                ? nombreDestinatario.trim() 
                : "Estimado/a";

            // Construir el link de tracking
            String trackingLink = "[Link de tracking]";
            if (trackingToken != null && !trackingToken.trim().isEmpty() && frontendBaseUrl != null && !frontendBaseUrl.trim().isEmpty()) {
                trackingLink = frontendBaseUrl.trim() + "/tracking/" + trackingToken.trim();
            }

            String cuerpo = String.format(
                "¡Hola %s!\n\n" +
                "Somos de Zeta Llegué. Nos complace informarte que hemos recibido tu pedido y estamos gestionando el envío. El número de tracking de tu envío es: %s.\n\n" +
                "Podés hacer el seguimiento en el siguiente enlace: %s\n\n" +
                "A partir de ahora, estamos a cargo y te garantizamos que el envío llegará hoy mismo. Ante cualquier duda, estamos a tu disposición.\n\n" +
                "¡Gracias por confiar en nosotros!\n\n" +
                "Saludos cordiales,\n" +
                "Matías de Zeta Llegué",
                nombre, tracking, trackingLink
            );

            message.setText(cuerpo);

            mailSender.send(message);
            log.info("Email de notificación enviado exitosamente a {} para tracking {}", destinatarioEmail, tracking);
        } catch (Exception e) {
            log.error("Error al enviar email de notificación a {} para tracking {}: {}", 
                destinatarioEmail, tracking, e.getMessage(), e);
            // No propagar la excepción para que no falle la creación del envío
        }
    }
}

