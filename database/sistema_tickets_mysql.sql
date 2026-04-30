-- SistemaTickets
-- Esquema SQL base para MySQL 8+
-- Ajustado sobre el ER compartido, consolidando el control de acceso en `acceso_registro`
-- y agregando `transaccion` para soportar pasarela de pagos y trazabilidad real.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS cortesia_emitida;
DROP TABLE IF EXISTS limite_cortesia;
DROP TABLE IF EXISTS acceso_registro;
DROP TABLE IF EXISTS entrada;
DROP TABLE IF EXISTS transaccion;
DROP TABLE IF EXISTS asiento_reservado;
DROP TABLE IF EXISTS asiento;
DROP TABLE IF EXISTS localidad;
DROP TABLE IF EXISTS autorizador_evento;
DROP TABLE IF EXISTS admin_evento;
DROP TABLE IF EXISTS `orden`;
DROP TABLE IF EXISTS evento;
DROP TABLE IF EXISTS usuario;

SET FOREIGN_KEY_CHECKS = 1;

CREATE DATABASE IF NOT EXISTS sistema_tickets
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sistema_tickets;

CREATE TABLE usuario (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  clave_hash VARCHAR(255) NOT NULL,
  rol_global ENUM('super_admin', 'cliente') NOT NULL DEFAULT 'cliente',
  telefono VARCHAR(30) NULL,
  estado ENUM('activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'activo',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuario_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE evento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(180) NOT NULL,
  descripcion TEXT NULL,
  ubicacion VARCHAR(255) NOT NULL,
  fecha_evento DATETIME NOT NULL,
  estatus ENUM('borrador', 'publicado', 'agotado', 'cancelado', 'finalizado') NOT NULL DEFAULT 'borrador',
  mapa_svg LONGTEXT NULL,
  creado_por BIGINT UNSIGNED NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_evento_fecha (fecha_evento),
  KEY idx_evento_estatus (estatus),
  KEY idx_evento_creado_por (creado_por),
  CONSTRAINT fk_evento_creado_por
    FOREIGN KEY (creado_por) REFERENCES usuario (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_evento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_evento (evento_id, usuario_id),
  KEY idx_admin_evento_usuario (usuario_id),
  CONSTRAINT fk_admin_evento_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_admin_evento_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE autorizador_evento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_autorizador_evento (evento_id, usuario_id),
  KEY idx_autorizador_evento_usuario (usuario_id),
  CONSTRAINT fk_autorizador_evento_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_autorizador_evento_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE localidad (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  precio DECIMAL(12, 2) NOT NULL,
  total_asientos INT UNSIGNED NOT NULL DEFAULT 0,
  asientos_disponibles INT UNSIGNED NOT NULL DEFAULT 0,
  orden_visual INT UNSIGNED NOT NULL DEFAULT 1,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_localidad_evento_nombre (evento_id, nombre),
  KEY idx_localidad_evento (evento_id),
  CONSTRAINT fk_localidad_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_localidad_capacidad
    CHECK (asientos_disponibles <= total_asientos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asiento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  localidad_id BIGINT UNSIGNED NOT NULL,
  numero_asiento VARCHAR(30) NOT NULL,
  fila VARCHAR(30) NULL,
  estatus ENUM('disponible', 'reservado', 'vendido', 'bloqueado', 'cortesia') NOT NULL DEFAULT 'disponible',
  pos_x DECIMAL(10, 2) NULL,
  pos_y DECIMAL(10, 2) NULL,
  metadata_json JSON NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asiento_localidad_numero (localidad_id, numero_asiento),
  KEY idx_asiento_localidad (localidad_id),
  KEY idx_asiento_estatus (estatus),
  CONSTRAINT fk_asiento_localidad
    FOREIGN KEY (localidad_id) REFERENCES localidad (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asiento_reservado (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  asiento_id BIGINT UNSIGNED NOT NULL,
  evento_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NULL,
  token_reserva CHAR(36) NULL,
  estatus ENUM('activo', 'expirado', 'confirmado', 'cancelado') NOT NULL DEFAULT 'activo',
  fecha_expiracion DATETIME NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asiento_reservado_token (token_reserva),
  KEY idx_asiento_reservado_asiento_estatus (asiento_id, estatus),
  KEY idx_asiento_reservado_evento (evento_id),
  KEY idx_asiento_reservado_usuario (usuario_id),
  KEY idx_asiento_reservado_expiracion (fecha_expiracion),
  CONSTRAINT fk_asiento_reservado_asiento
    FOREIGN KEY (asiento_id) REFERENCES asiento (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_asiento_reservado_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_asiento_reservado_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_asiento_reservado_fecha
    CHECK (fecha_expiracion > fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orden` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  evento_id BIGINT UNSIGNED NOT NULL,
  importe_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  moneda CHAR(3) NOT NULL DEFAULT 'GTQ',
  metodo_pago ENUM('tarjeta', 'efectivo', 'cortesia', 'transferencia', 'mixto') NOT NULL DEFAULT 'tarjeta',
  estado_pago ENUM('pendiente', 'autorizado', 'pagado', 'rechazado', 'cancelado', 'reembolsado') NOT NULL DEFAULT 'pendiente',
  referencia_transaccion VARCHAR(120) NULL,
  fecha_pagada DATETIME NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orden_usuario (usuario_id),
  KEY idx_orden_evento (evento_id),
  KEY idx_orden_estado_pago (estado_pago),
  CONSTRAINT fk_orden_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_orden_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transaccion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  orden_id BIGINT UNSIGNED NOT NULL,
  proveedor VARCHAR(80) NOT NULL,
  referencia_pasarela VARCHAR(150) NULL,
  monto DECIMAL(12, 2) NOT NULL,
  moneda CHAR(3) NOT NULL DEFAULT 'GTQ',
  metodo_pago ENUM('tarjeta', 'efectivo', 'cortesia', 'transferencia') NOT NULL,
  estado ENUM('pendiente', 'autorizada', 'pagada', 'rechazada', 'cancelada', 'reembolsada') NOT NULL DEFAULT 'pendiente',
  payload_respuesta JSON NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_transaccion_referencia_pasarela (referencia_pasarela),
  KEY idx_transaccion_orden (orden_id),
  KEY idx_transaccion_estado (estado),
  CONSTRAINT fk_transaccion_orden
    FOREIGN KEY (orden_id) REFERENCES `orden` (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE entrada (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  orden_id BIGINT UNSIGNED NOT NULL,
  evento_id BIGINT UNSIGNED NOT NULL,
  localidad_id BIGINT UNSIGNED NULL,
  asiento_id BIGINT UNSIGNED NULL,
  comprador_id BIGINT UNSIGNED NULL,
  codigo_qr VARCHAR(255) NOT NULL,
  tipo_pago ENUM('tarjeta', 'efectivo', 'cortesia', 'transferencia') NOT NULL,
  tipo_entrada ENUM('normal', 'cortesia', 'efectivo') NOT NULL DEFAULT 'normal',
  estado ENUM('emitida', 'usada', 'anulada', 'reembolsada') NOT NULL DEFAULT 'emitida',
  pdf_url VARCHAR(255) NULL,
  fecha_utilizado DATETIME NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_entrada_codigo_qr (codigo_qr),
  UNIQUE KEY uk_entrada_orden_asiento (orden_id, asiento_id),
  KEY idx_entrada_evento (evento_id),
  KEY idx_entrada_localidad (localidad_id),
  KEY idx_entrada_asiento (asiento_id),
  KEY idx_entrada_comprador (comprador_id),
  KEY idx_entrada_estado (estado),
  CONSTRAINT fk_entrada_orden
    FOREIGN KEY (orden_id) REFERENCES `orden` (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_entrada_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_entrada_localidad
    FOREIGN KEY (localidad_id) REFERENCES localidad (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_entrada_asiento
    FOREIGN KEY (asiento_id) REFERENCES asiento (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_entrada_comprador
    FOREIGN KEY (comprador_id) REFERENCES usuario (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE acceso_registro (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entrada_id BIGINT UNSIGNED NOT NULL,
  autorizado_por BIGINT UNSIGNED NOT NULL,
  resultado ENUM('permitido', 'denegado') NOT NULL DEFAULT 'permitido',
  observacion VARCHAR(255) NULL,
  fecha_acceso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_acceso_registro_entrada (entrada_id),
  KEY idx_acceso_registro_autorizado_por (autorizado_por),
  KEY idx_acceso_registro_fecha (fecha_acceso),
  CONSTRAINT fk_acceso_registro_entrada
    FOREIGN KEY (entrada_id) REFERENCES entrada (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_acceso_registro_autorizado_por
    FOREIGN KEY (autorizado_por) REFERENCES usuario (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE limite_cortesia (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  maximo_cortesias INT UNSIGNED NOT NULL DEFAULT 0,
  cortesias_usadas INT UNSIGNED NOT NULL DEFAULT 0,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_limite_cortesia_evento_usuario (evento_id, usuario_id),
  KEY idx_limite_cortesia_usuario (usuario_id),
  CONSTRAINT fk_limite_cortesia_evento
    FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_limite_cortesia_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_limite_cortesia_uso
    CHECK (cortesias_usadas <= maximo_cortesias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cortesia_emitida (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  limite_cortesia_id BIGINT UNSIGNED NOT NULL,
  entrada_id BIGINT UNSIGNED NOT NULL,
  beneficiario_nombre VARCHAR(150) NOT NULL,
  beneficiario_email VARCHAR(150) NULL,
  generado_por BIGINT UNSIGNED NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cortesia_emitida_entrada (entrada_id),
  KEY idx_cortesia_emitida_limite (limite_cortesia_id),
  KEY idx_cortesia_emitida_generado_por (generado_por),
  CONSTRAINT fk_cortesia_emitida_limite
    FOREIGN KEY (limite_cortesia_id) REFERENCES limite_cortesia (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cortesia_emitida_entrada
    FOREIGN KEY (entrada_id) REFERENCES entrada (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cortesia_emitida_generado_por
    FOREIGN KEY (generado_por) REFERENCES usuario (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
