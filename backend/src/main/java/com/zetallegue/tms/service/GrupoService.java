package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.ClienteDTO;
import com.zetallegue.tms.dto.GrupoDTO;
import com.zetallegue.tms.model.Cliente;
import com.zetallegue.tms.model.Grupo;
import com.zetallegue.tms.repository.ClienteRepository;
import com.zetallegue.tms.repository.GrupoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GrupoService {

    private final GrupoRepository grupoRepository;
    private final ClienteRepository clienteRepository;
    private final ClienteService clienteService;

    @Transactional(readOnly = true)
    public List<GrupoDTO> listarTodos() {
        return grupoRepository.findAll().stream()
                .map(this::toDTOWithClientes)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GrupoDTO obtenerPorId(Long id) {
        Grupo grupo = grupoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado con id: " + id));
        return toDTOWithClientes(grupo);
    }

    @Transactional
    public GrupoDTO crear(GrupoDTO dto) {
        if (dto.getNombre() == null || dto.getNombre().trim().isEmpty()) {
            throw new RuntimeException("El nombre del grupo es obligatorio");
        }
        Grupo grupo = new Grupo();
        grupo.setNombre(dto.getNombre().trim());
        grupo = grupoRepository.save(grupo);
        return toDTO(grupo);
    }

    @Transactional
    public GrupoDTO actualizarNombre(Long id, String nombre) {
        Grupo grupo = grupoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Grupo no encontrado con id: " + id));
        if (nombre == null || nombre.trim().isEmpty()) {
            throw new RuntimeException("El nombre del grupo es obligatorio");
        }
        grupo.setNombre(nombre.trim());
        grupo = grupoRepository.save(grupo);
        return toDTO(grupo);
    }

    private GrupoDTO toDTO(Grupo grupo) {
        GrupoDTO dto = new GrupoDTO();
        dto.setId(grupo.getId());
        dto.setNombre(grupo.getNombre());
        dto.setClientes(null);
        return dto;
    }

    private GrupoDTO toDTOWithClientes(Grupo grupo) {
        GrupoDTO dto = toDTO(grupo);
        List<Cliente> clientes = clienteRepository.findByGrupoId(grupo.getId());
        List<ClienteDTO> clienteDTOs = clientes.stream()
                .map(clienteService::toDTOFromEntity)
                .collect(Collectors.toList());
        dto.setClientes(clienteDTOs);
        return dto;
    }
}
