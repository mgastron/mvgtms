package com.zetallegue.tms.service;

import com.zetallegue.tms.dto.ListaPrecioDTO;
import com.zetallegue.tms.dto.PageResponseDTO;
import com.zetallegue.tms.dto.ZonaDTO;
import com.zetallegue.tms.model.ListaPrecio;
import com.zetallegue.tms.model.Zona;
import com.zetallegue.tms.repository.ListaPrecioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ListaPrecioService {

    private final ListaPrecioRepository listaPrecioRepository;

    @Transactional(readOnly = true)
    public PageResponseDTO<ListaPrecioDTO> obtenerTodasLasListasPrecios(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ListaPrecio> pageResult = listaPrecioRepository.findAll(pageable);
        
        List<ListaPrecioDTO> content = pageResult.getContent().stream()
            .map(this::toDTOSimple)
            .collect(Collectors.toList());
        
        return new PageResponseDTO<>(
            content,
            pageResult.getTotalPages(),
            pageResult.getTotalElements(),
            page,
            size
        );
    }

    @Transactional(readOnly = true)
    public ListaPrecioDTO obtenerListaPrecioPorId(Long id) {
        Optional<ListaPrecio> listaPrecioOpt = listaPrecioRepository.findById(id);
        
        if (listaPrecioOpt.isEmpty()) {
            throw new RuntimeException("Lista de precios no encontrada con id: " + id);
        }

        ListaPrecio listaPrecio = listaPrecioOpt.get();
        ListaPrecioDTO dto = toDTO(listaPrecio);

        // Si no tiene zonas propias, cargar las zonas de la lista referenciada
        if (!listaPrecio.getZonaPropia() && listaPrecio.getListaPrecioSeleccionada() != null) {
            Optional<ListaPrecio> listaReferenciadaOpt = listaPrecioRepository.findById(listaPrecio.getListaPrecioSeleccionada());
            if (listaReferenciadaOpt.isPresent()) {
                ListaPrecio listaReferenciada = listaReferenciadaOpt.get();
                if (listaReferenciada.getZonaPropia() && listaReferenciada.getZonas() != null && !listaReferenciada.getZonas().isEmpty()) {
                    dto.setZonas(toZonaDTOList(listaReferenciada.getZonas()));
                }
            }
        }

        return dto;
    }

    private ListaPrecioDTO toDTO(ListaPrecio listaPrecio) {
        ListaPrecioDTO dto = new ListaPrecioDTO();
        dto.setId(listaPrecio.getId());
        dto.setCodigo(listaPrecio.getCodigo());
        dto.setNombre(listaPrecio.getNombre());
        dto.setZonaPropia(listaPrecio.getZonaPropia());
        dto.setListaPrecioSeleccionada(listaPrecio.getListaPrecioSeleccionada() != null ? 
                                       listaPrecio.getListaPrecioSeleccionada().toString() : null);
        
        if (listaPrecio.getZonaPropia() && listaPrecio.getZonas() != null) {
            dto.setZonas(toZonaDTOList(listaPrecio.getZonas()));
        } else {
            dto.setZonas(new ArrayList<>());
        }

        return dto;
    }

    private ListaPrecioDTO toDTOSimple(ListaPrecio listaPrecio) {
        // Versión simplificada sin cargar zonas (para listado)
        ListaPrecioDTO dto = new ListaPrecioDTO();
        dto.setId(listaPrecio.getId());
        dto.setCodigo(listaPrecio.getCodigo());
        dto.setNombre(listaPrecio.getNombre());
        dto.setZonaPropia(listaPrecio.getZonaPropia());
        dto.setListaPrecioSeleccionada(listaPrecio.getListaPrecioSeleccionada() != null ? 
                                       listaPrecio.getListaPrecioSeleccionada().toString() : null);
        dto.setZonas(new ArrayList<>()); // No cargar zonas en el listado para mejor rendimiento
        return dto;
    }

    private List<ZonaDTO> toZonaDTOList(List<Zona> zonas) {
        List<ZonaDTO> zonaDTOs = new ArrayList<>();
        for (Zona zona : zonas) {
            ZonaDTO zonaDTO = new ZonaDTO();
            zonaDTO.setId(zona.getId() != null ? zona.getId().toString() : null);
            zonaDTO.setCodigo(zona.getCodigo());
            zonaDTO.setNombre(zona.getNombre());
            zonaDTO.setCps(zona.getCps());
            zonaDTO.setValor(zona.getValor());
            zonaDTOs.add(zonaDTO);
        }
        return zonaDTOs;
    }
}

