-- Datos iniciales para desarrollo
INSERT INTO clientes (codigo, nombre_fantasia, razon_social, numero_documento, habilitado, integraciones) VALUES
('zetaenvi', 'ZETA ENVIOS', '', '', true, ''),
('VORO', 'VORO', '', '', true, ''),
('vml2', 'VML FERRECLICK', 'VML2', '', true, ''),
('vlt', 'voltra', '', '', true, ''),
('vamo', 'vamo arriba', '', '', true, ''),
('Udg', 'UDG', 'UDG', '', true, ''),
('tzedek', 'llegue tzedek', '', '', true, ''),
('test1', 'Test Cliente 1', 'Test S.A.', '12345678', false, ''),
('test2', 'Test Cliente 2', 'Test2 S.R.L.', '87654321', true, '');

-- Usuarios iniciales para desarrollo
INSERT INTO usuarios (nombre, apellido, usuario, contraseña, perfil, habilitado, bloqueado) VALUES
('andres', 'torres', 'andrestorres', 'pass456', 'Chofer', true, false),
('mauro', 'coria', 'maurocoria', 'pass789', 'Chofer', true, false),
('fernando', 'bautier', 'fernandobautier', 'pass101', 'Chofer', true, false),
('ignacio', 'folgar', 'nachofolgar', 'pass202', 'Chofer', true, false),
('jonathan', 'vargas', 'jonathanvargas', 'pass303', 'Chofer', true, false),
('osta', 'el que reparte', 'osta', 'pass404', 'Chofer', true, false),
('smud', 'smud', 'smudchofer', 'pass505', 'Chofer', true, false),
('Micaela', 'Silva', 'Micasilva', 'pass606', 'Chofer', true, false),
('Marco', 'Torres', 'Torres', 'pass707', 'Chofer', true, false);

