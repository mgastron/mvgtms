package com.zetallegue.tms.util;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * CABA / Zona 1 / 2 / 3 según cordones AMBA.
 * Flex no usa provincia: un CP fuera de AMBA queda Sin Zona hasta geocodificar la calle.
 */
public final class ZonaEntregaUtil {

    private ZonaEntregaUtil() {}

    public static String determinar(String codigoPostal, String localidad) {
        return determinarSoloAmba(codigoPostal);
    }

    /** Flex y última milla Nexo: solo CABA / Zona 1 / 2 / 3. */
    public static String determinarSoloAmba(String codigoPostal) {
        String amba = zonaAmba(codigoPostal);
        return amba != null ? amba : "Sin Zona";
    }

    public static boolean coordenadasEnAmba(Double lat, Double lng) {
        if (lat == null || lng == null) return false;
        return lat <= -34.05 && lat >= -35.05 && lng >= -59.15 && lng <= -57.85;
    }

    public static String limpiarCp(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String d = raw.replaceAll("\\D", "");
        if (d.length() >= 4) {
            return d.substring(0, 4);
        }
        return d;
    }

    public static String zonaAmba(String codigoPostal) {
        if (codigoPostal == null || codigoPostal.isBlank()) {
            return null;
        }
        String cpLimpio = codigoPostal.replaceAll("\\D", "");
        if (cpLimpio.isEmpty()) {
            return null;
        }
        int cpNumero;
        try {
            cpNumero = Integer.parseInt(cpLimpio);
        } catch (NumberFormatException e) {
            return null;
        }
        if (cpNumero >= 1000 && cpNumero <= 1599) {
            return "CABA";
        }
        if (CP_ZONA_1.contains(cpLimpio)) return "Zona 1";
        if (CP_ZONA_2.contains(cpLimpio)) return "Zona 2";
        if (CP_ZONA_3.contains(cpLimpio)) return "Zona 3";
        return null;
    }

    public static String provinciaPorCp(String codigoPostal) {
        if (codigoPostal == null || codigoPostal.isBlank()) {
            return null;
        }
        String cpLimpio = codigoPostal.replaceAll("\\D", "");
        if (cpLimpio.length() < 4) {
            return null;
        }
        int cp;
        try {
            cp = Integer.parseInt(cpLimpio.length() > 4 ? cpLimpio.substring(0, 4) : cpLimpio);
        } catch (NumberFormatException e) {
            return null;
        }
        for (Object[] rango : RANGOS_PROVINCIA) {
            int desde = (Integer) rango[0];
            int hasta = (Integer) rango[1];
            if (cp >= desde && cp <= hasta) {
                return (String) rango[2];
            }
        }
        return null;
    }

    private static final Object[][] RANGOS_PROVINCIA = {
            {1000, 1499, "CABA"},
            {1500, 1999, "Buenos Aires"},
            {2000, 2409, "Santa Fe"},
            {2413, 2599, "Santa Fe"},
            {2600, 2639, "Santa Fe"},
            {2700, 2941, "Buenos Aires"},
            {3000, 3061, "Santa Fe"},
            {3100, 3289, "Entre Ríos"},
            {3300, 3388, "Misiones"},
            {3400, 3486, "Corrientes"},
            {3500, 3569, "Chaco"},
            {3600, 3636, "Formosa"},
            {4000, 4197, "Tucumán"},
            {4200, 4353, "Santiago del Estero"},
            {4400, 4550, "Salta"},
            {4600, 4655, "Jujuy"},
            {4700, 4753, "Catamarca"},
            {5000, 5299, "Córdoba"},
            {5300, 5380, "La Rioja"},
            {5400, 5467, "San Juan"},
            {5500, 5637, "Mendoza"},
            {5700, 5779, "San Luis"},
            {5800, 5988, "Córdoba"},
            {6000, 6244, "Buenos Aires"},
            {6300, 6389, "La Pampa"},
            {6400, 6761, "Buenos Aires"},
            {7000, 7550, "Buenos Aires"},
            {7600, 7675, "Buenos Aires"},
            {8000, 8187, "Buenos Aires"},
            {8300, 8375, "Neuquén"},
            {8400, 8534, "Río Negro"},
            {9040, 9053, "Santa Cruz"},
            {9000, 9220, "Chubut"},
            {9400, 9405, "Santa Cruz"},
            {9410, 9420, "Tierra del Fuego"},
    };

    private static final Set<String> CP_ZONA_1 = new HashSet<>(Arrays.asList(
            "1602","1603","1604","1605","1606","1607","1609","1636","1637","1638","1640","1641","1642","1643","1644","1645","1646","1649","1650","1651","1652","1653","1655","1657","1672","1674","1675","1676","1678","1682","1683","1684","1685","1686","1687","1688","1692","1702","1703","1704","1706","1707","1708","1712","1713","1714","1715","1751","1752","1753","1754","1766","1773","1821","1822","1823","1824","1825","1826","1827","1828","1829","1831","1832","1833","1834","1835","1836","1868","1869","1870","1871","1872","1873","1874","1875"
    ));
    private static final Set<String> CP_ZONA_2 = new HashSet<>(Arrays.asList(
            "1608","1610","1611","1612","1613","1614","1615","1616","1617","1618","1621","1624","1648","1659","1660","1661","1662","1663","1664","1665","1666","1667","1670","1671","1716","1718","1722","1723","1724","1736","1738","1740","1742","1743","1744","1745","1746","1755","1757","1758","1759","1761","1763","1764","1765","1768","1770","1771","1772","1774","1776","1778","1785","1786","1801","1802","1803","1804","1805","1806","1807","1812","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1851","1852","1853","1854","1855","1856","1859","1860","1861","1863","1867","1876","1877","1878","1879","1880","1881","1882","1883","1884","1885","1886","1887","1888","1889","1890","1891","1893"
    ));
    private static final Set<String> CP_ZONA_3 = new HashSet<>(Arrays.asList(
            "1601","1619","1620","1622","1623","1625","1626","1627","1628","1629","1630","1631","1632","1633","1634","1635","1639","1647","1669","1727","1748","1749","1808","1814","1815","1816","1858","1862","1864","1865","1894","1895","1896","1897","1898","1900","1901","1902","1903","1904","1905","1906","1907","1908","1909","1910","1912","1914","1916","1923","1924","1925","1926","1927","1929","1931","1984","2800","2801","2802","2804","2805","2806","2808","2814","2816","6608","6700","6701","6702","6703","6706","6708","6712"
    ));
}
