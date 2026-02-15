// Función para determinar la zona de entrega basándose en el código postal

// Zonas por defecto (cordones) - definidas según Lista Precios
const zonasPorDefecto = {
  CABA: {
    nombre: "CABA",
    cps: "1000-1599", // Rango
  },
  PRIMER_CORDON: {
    nombre: "Zona 1",
    cps: "1602, 1603, 1604, 1605, 1606, 1607, 1609, 1636, 1637, 1638, 1640, 1641, 1642, 1643, 1644, 1645, 1646, 1649, 1650, 1651, 1652, 1653, 1655, 1657, 1672, 1674, 1675, 1676, 1678, 1682, 1683, 1684, 1685, 1686, 1687, 1688, 1692, 1702, 1703, 1704, 1706, 1707, 1708, 1712, 1713, 1714, 1715, 1751, 1752, 1753, 1754, 1766, 1773, 1821, 1822, 1823, 1824, 1825, 1826, 1827, 1828, 1829, 1831, 1832, 1833, 1834, 1835, 1836, 1868, 1869, 1870, 1871, 1872, 1873, 1874, 1875",
  },
  SEGUNDO_CORDON: {
    nombre: "Zona 2",
    cps: "1608, 1610, 1611, 1612, 1613, 1614, 1615, 1616, 1617, 1618, 1621, 1624, 1648, 1659, 1660, 1661, 1662, 1663, 1664, 1665, 1666, 1667, 1670, 1671, 1716, 1718, 1722, 1723, 1724, 1736, 1738, 1740, 1742, 1743, 1744, 1745, 1746, 1755, 1757, 1758, 1759, 1761, 1763, 1764, 1765, 1768, 1770, 1771, 1772, 1774, 1776, 1778, 1785, 1786, 1801, 1802, 1803, 1804, 1805, 1806, 1807, 1812, 1837, 1838, 1839, 1840, 1841, 1842, 1843, 1844, 1845, 1846, 1847, 1848, 1849, 1851, 1852, 1853, 1854, 1855, 1856, 1859, 1860, 1861, 1863, 1867, 1876, 1877, 1878, 1879, 1880, 1881, 1882, 1883, 1884, 1885, 1886, 1887, 1888, 1889, 1890, 1891, 1893",
  },
  TERCER_CORDON: {
    nombre: "Zona 3",
    cps: "1601, 1619, 1620, 1622, 1623, 1625, 1626, 1627, 1628, 1629, 1630, 1631, 1632, 1633, 1634, 1635, 1639, 1647, 1669, 1727, 1748, 1749, 1808, 1814, 1815, 1816, 1858, 1862, 1864, 1865, 1894, 1895, 1896, 1897, 1898, 1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909, 1910, 1912, 1914, 1916, 1923, 1924, 1925, 1926, 1927, 1929, 1931, 1984, 2800, 2801, 2802, 2804, 2805, 2806, 2808, 2814, 2816, 6608, 6700, 6701, 6702, 6703, 6706, 6708, 6712",
  },
}

/**
 * Determina la zona de entrega basándose en el código postal
 * @param codigoPostal - Código postal (solo números, como string o number)
 * @param localidad - Localidad como fallback si no se encuentra zona
 * @returns Nombre de la zona ("CABA", "Zona 1", "Zona 2", "Zona 3") o la localidad si no coincide
 */
export function determinarZonaEntrega(codigoPostal: string | number | undefined | null, localidad?: string): string {
  if (!codigoPostal) {
    return "Sin Zona"
  }

  // Convertir a string y limpiar (solo números)
  const cpLimpio = String(codigoPostal).replace(/\D/g, "")
  
  if (!cpLimpio) {
    return "Sin Zona"
  }

  const cpNumero = parseInt(cpLimpio, 10)
  
  if (isNaN(cpNumero)) {
    return "Sin Zona"
  }

  // Verificar CABA (1000-1599)
  if (cpNumero >= 1000 && cpNumero <= 1599) {
    return "CABA"
  }

  // Verificar Primer Cordón (Zona 1)
  const primerCordonCps = zonasPorDefecto.PRIMER_CORDON.cps.split(",").map(cp => cp.trim())
  if (primerCordonCps.includes(cpLimpio)) {
    return "Zona 1"
  }

  // Verificar Segundo Cordón (Zona 2)
  const segundoCordonCps = zonasPorDefecto.SEGUNDO_CORDON.cps.split(",").map(cp => cp.trim())
  if (segundoCordonCps.includes(cpLimpio)) {
    return "Zona 2"
  }

  // Verificar Tercer Cordón (Zona 3)
  const tercerCordonCps = zonasPorDefecto.TERCER_CORDON.cps.split(",").map(cp => cp.trim())
  if (tercerCordonCps.includes(cpLimpio)) {
    return "Zona 3"
  }

  // Si no coincide con ninguna zona, devolver "Sin Zona"
  return "Sin Zona"
}

