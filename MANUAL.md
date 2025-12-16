
# Manual de Usuario y Administración - Asesor Farmacológico IA

Bienvenido al manual oficial de la aplicación. Este documento cubre desde las funciones básicas para usuarios personales hasta las herramientas avanzadas para profesionales y administradores.

## Tabla de Contenidos
1. [Introducción y Registro](#1-introducción-y-registro)
2. [Guía para el Usuario Personal](#2-guía-para-el-usuario-personal)
3. [Guía para el Profesional (PRO)](#3-guía-para-el-profesional-pro)
4. [Guía de Administración (Superuser)](#4-guía-de-administración-superuser)
5. [Solución de Problemas Comunes](#5-solución-de-problemas-comunes)

---

## 1. Introducción y Registro

**Asesor Farmacológico IA** es una herramienta de apoyo a la decisión clínica impulsada por Google Gemini. Permite analizar interacciones medicamentosas complejas considerando no solo el cruce fármaco-fármaco, sino también condiciones de salud, alergias, suplementos y genética.

### Inicio de Sesión y Registro
El sistema ofrece dos métodos de acceso seguro:

1.  **Google:** Inicio de sesión rápido con su cuenta existente.
2.  **Correo Electrónico:** 
    *   Puede registrar una nueva cuenta proporcionando su **Nombre Completo**, **Institución** (obligatorio para registro), **Correo** y **Contraseña**.
    *   **Requisitos de Seguridad:** La contraseña debe tener al menos 8 caracteres e incluir una mayúscula, una minúscula y un número.

### Roles de Usuario
*   **Personal:** Acceso básico. Puede realizar análisis individuales, guardar su propio historial y ver resultados.
*   **Profesional (Pro):** Acceso avanzado. Incluye gestión de pacientes, análisis por lotes (CSV), investigador clínico, dashboard de estadísticas y exportación de datos.
*   **Admin (Superuser):** Control total. Incluye todas las funciones Pro más la configuración global del sistema y fuentes de IA.

---

## 2. Guía para el Usuario Personal

### Realizar un Nuevo Análisis
1.  Vaya a la pestaña **Nuevo Análisis**.
2.  **Medicamentos:** Escriba el nombre del fármaco. El sistema autocompletará con nombres comerciales y genéricos. Si no aparece, seleccione la opción "Usar [Nombre]".
    *   *Tip:* Añada dosis y frecuencia para un análisis más preciso.
3.  **Alergias:** Indique alergias conocidas (ej. Penicilina, AINEs).
4.  **Suplementos (NUEVO):** Utilice el buscador específico para añadir suplementos (ej. "Ginkgo Biloba", "Melatonina"). El sistema realizará un **análisis proactivo en tiempo real** para detectar riesgos inmediatos con su medicación actual antes de realizar el análisis completo.
5.  **Condiciones:** Escriba enfermedades crónicas (ej. Hipertensión, Diabetes). Campo obligatorio para el contexto clínico.
6.  **Analizar:** Pulse el botón para generar el informe completo.

### Interpretación de Resultados
*   **Alertas Proactivas:** Aparecen inmediatamente en el formulario si detectan riesgos críticos (ej. Alergia directa, interacción grave conocida).
*   **Resumen Crítico:** Lea siempre esto primero en el informe generado.
*   **Tarjetas de Interacción:** Clasificadas por colores según riesgo (Rojo = Alto/Crítico, Ámbar = Moderado, Azul = Bajo).
*   **Fuentes:** Al final del reporte encontrará enlaces a las fuentes consultadas (PubMed, NIH, etc.).

---

## 3. Guía para el Profesional (PRO)

Los usuarios con rol Profesional tienen herramientas adicionales para la práctica clínica y la investigación.

### Gestión de Pacientes
*   **Pestaña Pacientes:** Permite guardar perfiles completos con sus historiales médicos. Útil para seguimiento longitudinal.
*   **Guardar/Actualizar:** En el formulario principal, use el botón "Guardar Perfil" junto a "Analizar" para almacenar el estado actual del paciente (incluyendo factores farmacogenéticos y condiciones).

### Análisis por Lote (Batch Analysis)
Ideal para revisar bases de datos de pacientes o estudios clínicos.
1.  En la pestaña "Nuevo Análisis", cambie el interruptor a **"Por Lote"**.
2.  Descargue la **Plantilla CSV**.
3.  Rellene el CSV manteniendo el formato (separe medicamentos con punto y coma `;`).
4.  Suba el archivo. La IA procesará fila por fila.
5.  Al finalizar, podrá exportar todos los reportes individuales o un resumen consolidado en CSV.

### Investigador Clínico (Investigator)
Una herramienta avanzada de **razonamiento inverso** ("Reverse Pharmacology") accesible desde la pestaña **Investigador**.

**Flujo de Trabajo:**
1.  Cargue los datos de un paciente en la pestaña "Nuevo Análisis" (o seleccione un perfil guardado). **No es necesario pulsar Analizar**, solo tener los datos cargados.
2.  Vaya a la pestaña **Investigador Clínico**.
3.  Verá un resumen del "Contexto Clínico Activo" (Medicamentos y condiciones cargados).
4.  Introduzca un síntoma observado o signo clínico (ej. "Neutropenia", "Mareos recurrentes", "Prolongación QT").
5.  Pulse "Investigar Causa".
6.  La IA determinará si el síntoma puede explicarse por:
    *   Efecto adverso directo de un fármaco.
    *   Una interacción fármaco-fármaco o fármaco-condición.
    *   Un factor farmacogenético (ej. Metabolizador lento causando acumulación).

### Dashboard de Farmacovigilancia
Visualice estadísticas agregadas de su práctica o departamento.
*   **Sub-pestaña Análisis:** Métricas sobre interacciones detectadas, fármacos más frecuentes y una tabla de **Interacciones Críticas Frecuentes**.
*   **Sub-pestaña Pacientes:** Resumen demográfico y clínico de los pacientes únicos gestionados (basado en la última instantánea de cada ID).
*   **Exportación:** Descargue gráficos y tablas en PDF o los datos crudos del dashboard en CSV.

### Farmacogenética
Acceso a campos específicos para introducir genes (ej. CYP2D6), variantes y fenotipos metabolizadores para un análisis de medicina de precisión.

---

## 4. Guía de Administración (Superuser)

El rol de Administrador tiene acceso a la pestaña exclusiva: **Admin (⚙️)**.

### Configuración del Sistema
Controle el comportamiento global de la IA.
1.  **Fuentes Prioritarias:** Defina qué dominios (ej: `nih.gov, mayoclinic.org`) la IA debe priorizar para sus respuestas.
2.  **Fuentes Excluidas:** Bloquee dominios poco fiables para reducir alucinaciones.
3.  **Nivel de Seguridad:** Ajuste la sensibilidad de los filtros de contenido de la IA (Standard es el recomendado).

### Gestión de Usuarios
*   Visualice la lista de todos los usuarios registrados.
*   Edite roles (`Personal`, `Professional`, `Admin`) directamente desde la interfaz.
*   Edite información básica de perfil (Nombre, Institución) si es necesario para correcciones administrativas.

### Datos Globales (Estudio Multicéntrico)
*   **Exportación Maestra:** Permite descargar un CSV con los datos anonimizados de **todos los pacientes** registrados en el sistema por usuarios Profesionales o Administradores.
*   *Nota:* Los datos de usuarios personales se excluyen automáticamente de esta exportación para garantizar la calidad clínica del dataset.

---

## 5. Solución de Problemas Comunes

**Error: "Dominio no autorizado" al iniciar sesión**
*   Esto ocurre si accede desde una URL nueva (ej. una preview de desarrollo).
*   Solución: Copie el dominio del error y añádalo en Firebase Console -> Authentication -> Settings -> Authorized Domains.

**Error 429 (Resource Exhausted)**
*   Ha superado la cuota de la API de Gemini. Espere un minuto y reintente.

**Botón "Analizar" deshabilitado**
*   Asegúrese de haber añadido al menos un medicamento y una condición de salud. Son campos obligatorios para dar contexto a la IA.

**"API Key Missing"**
*   La aplicación requiere una variable de entorno `VITE_GEMINI_API_KEY` (o `API_KEY`) configurada en el servidor/hosting para comunicarse con Google Gemini.
