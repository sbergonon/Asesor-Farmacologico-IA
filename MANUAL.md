
# Manual de Usuario y Administración - Asesor Farmacológico IA

Bienvenido al manual oficial de la aplicación. Este documento cubre desde las funciones básicas para usuarios personales hasta las herramientas avanzadas para profesionales y administradores, incluyendo las últimas actualizaciones en generación de informes y razonamiento clínico.

## Tabla de Contenidos
1. [Introducción y Registro](#1-introducción-y-registro)
2. [Guía para el Usuario Personal](#2-guía-para-el-usuario-personal)
3. [Guía para el Profesional (PRO)](#3-guía-para-el-profesional-pro)
4. [Gestión de Informes y Compartición](#4-gestión-de-informes-y-compartición)
5. [Guía de Administración (Superuser)](#5-guía-de-administración-superuser)
6. [Solución de Problemas Comunes](#6-solución-de-problemas-comunes)

---

## 1. Introducción y Registro

**Asesor Farmacológico IA** es una herramienta de apoyo a la decisión clínica impulsada por Google Gemini. Permite analizar interacciones medicamentosas complejas considerando no solo el cruce fármaco-fármaco, sino también condiciones de salud, alergias, suplementos y genética.

### Roles de Usuario
*   **Personal:** Acceso básico. Puede realizar análisis individuales, compartir por WhatsApp y descargar su informe.
*   **Profesional (Pro):** Acceso avanzado. Incluye gestión de pacientes (base de datos), análisis por lotes (CSV), investigador clínico (causalidad) y dashboard de estadísticas.
*   **Admin (Superuser):** Control total. Configuración de fuentes de IA, gestión de roles de usuario y exportación global de datos.

---

## 2. Guía para el Usuario Personal

### Realizar un Nuevo Análisis
1.  Vaya a la pestaña **Nuevo Análisis**.
2.  **Medicamentos:** Escriba el nombre del fármaco. Al seleccionarlo, se desplegarán opciones de **Dosis** y **Frecuencia**.
    *   *Nota:* Al hacer clic en estos campos, verá siempre la lista completa de opciones estándar (ej. cada 8h, con comidas).
3.  **Alergias:** Indique alergias (ej. Penicilina). Crucial para evitar reacciones cruzadas.
4.  **Suplementos:** Busque sustancias como "Melatonina" o "Ginkgo". El sistema detectará riesgos en tiempo real incluso antes de generar el informe.
5.  **Analizar:** Pulse el botón para generar el informe detallado.

---

## 3. Guía para el Profesional (PRO)

### Investigador Clínico (Causalidad)
Esta herramienta permite realizar **Farmacología Inversa**. En lugar de predecir riesgos, investiga la causa de un síntoma ya observado.
1.  Cargue el perfil del paciente en la pestaña principal.
2.  En la pestaña **Investigador**, describa el signo clínico (ej. "Tos seca", "Erupción cutánea").
3.  La IA cruzará la farmacocinética de los medicamentos del paciente para determinar la probabilidad de que sean la causa.

### Análisis por Lote (Batch Analysis)
Permite subir un fichero **CSV** con múltiples pacientes para un análisis masivo. Al finalizar, puede sincronizar los resultados con un sistema de Historia Clínica Electrónica (HCE) simulado vía FHIR.

---

## 4. Gestión de Informes y Compartición

### Nuevo Motor de PDF Profesional
Los informes generados ahora utilizan tecnología de texto vectorial:
*   **Legibilidad Total:** El texto es real y seleccionable (no es una imagen).
*   **Numeración Inteligente:** Incluye pie de página con formato "Página X de Y".
*   **Diseño Clínico:** Cabeceras profesionales con datos de contexto del paciente.

### Compartir por WhatsApp
Ideal para la comunicación rápida médico-paciente. Al pulsar el botón de WhatsApp:
*   Se genera un mensaje estructurado con el ID del paciente.
*   Se incluye la lista de medicación analizada.
*   **Resumen de Riesgos:** Si existen alertas críticas, se incluyen directamente en el texto del mensaje para una lectura inmediata sin abrir archivos.

---

## 5. Guía de Administración (Superuser)

### Control de Fuentes (Source Manager)
El administrador puede definir qué dominios web utiliza la IA para su "Grounding" (verificación de datos):
*   **Prioritarias:** Sitios como `pubmed.ncbi.nlm.nih.gov` o `drugs.com`.
*   **Excluidas:** Sitios no científicos o foros para evitar "alucinaciones" del modelo.

### Gestión de Usuarios
Desde el panel de Admin, se pueden promover usuarios a **Profesional** o **Administrador** para habilitar las funciones avanzadas.

---

## 6. Solución de Problemas Comunes

**¿Por qué el PDF no se descarga?**
Asegúrese de que su navegador permite las ventanas emergentes o descargas automáticas. El nuevo motor es muy rápido y genera el archivo localmente.

**"API Key Missing"**
La aplicación requiere una clave de Google Gemini. Si aparece este error, contacte con su administrador para configurar la variable `API_KEY`.

**Frecuencias no visibles**
Si al escribir una dosis no ve la lista completa, simplemente borre el campo o haga clic en la flecha lateral del selector para resetear el filtro de búsqueda.
