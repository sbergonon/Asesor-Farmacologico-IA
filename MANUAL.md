
# Manual de Usuario y Administración - Asesor Farmacológico IA

Bienvenido al manual oficial de la aplicación. Este documento cubre desde las funciones básicas para usuarios personales hasta las herramientas avanzadas para profesionales y administradores.

## Tabla de Contenidos
1. [Introducción](#1-introducción)
2. [Guía para el Usuario Personal](#2-guía-para-el-usuario-personal)
3. [Guía para el Profesional (PRO)](#3-guía-para-el-profesional-pro)
4. [Guía de Administración (Superuser)](#4-guía-de-administración-superuser)
5. [Solución de Problemas Comunes](#5-solución-de-problemas-comunes)

---

## 1. Introducción

**Asesor Farmacológico IA** es una herramienta de apoyo a la decisión clínica impulsada por Google Gemini. Permite analizar interacciones medicamentosas complejas considerando no solo el cruce fármaco-fármaco, sino también condiciones de salud, alergias, suplementos y genética.

### Roles de Usuario
*   **Personal:** Acceso básico. Puede realizar análisis individuales, guardar su propio historial y ver resultados.
*   **Profesional (Pro):** Acceso avanzado. Incluye gestión de pacientes, análisis por lotes (CSV), dashboard de estadísticas y exportación de datos.
*   **Admin (Superuser):** Control total. Incluye todas las funciones Pro más la configuración global del sistema y fuentes de IA.

---

## 2. Guía para el Usuario Personal

### Inicio de Sesión
Puede iniciar sesión con su cuenta de Google. Si es su primera vez, se le asignará automáticamente el rol **Personal**.
*Nota:* Si está probando la aplicación en un entorno de desarrollo, verá un botón de "Modo Demo". Este botón no aparece en la versión pública final.

### Realizar un Nuevo Análisis
1.  Vaya a la pestaña **Nuevo Análisis**.
2.  **Medicamentos:** Escriba el nombre del fármaco. El sistema autocompletará con nombres comerciales y genéricos. Si no aparece, seleccione la opción "Usar [Nombre] (Añadir manualmente)".
    *   *Tip:* Añada dosis y frecuencia para un análisis más preciso.
3.  **Alergias:** Indique alergias conocidas (ej. Penicilina).
4.  **Condiciones:** Escriba enfermedades crónicas (ej. Hipertensión, Diabetes).
5.  **Analizar:** Pulse el botón de análisis.

### Interpretación de Resultados
*   **Resumen Crítico:** Lea siempre esto primero. La IA destacará riesgos vitales aquí.
*   **Tarjetas de Interacción:** Clasificadas por colores según riesgo (Rojo = Alto/Crítico, Ámbar = Moderado, Azul = Bajo).
*   **Fuentes:** Al final del reporte encontrará enlaces a las fuentes consultadas (PubMed, NIH, etc.).

---

## 3. Guía para el Profesional (PRO)

Los usuarios profesionales tienen herramientas adicionales para la práctica clínica y la investigación.

### Gestión de Pacientes
*   **Pestaña Pacientes:** Permite guardar perfiles completos. Útil para seguimiento longitudinal.
*   **Guardar/Actualizar:** En el formulario principal, use el botón "Guardar Perfil" junto a "Analizar".

### Análisis por Lote (Batch Analysis)
Ideal para revisar bases de datos de pacientes o estudios clínicos.
1.  En la pestaña "Nuevo Análisis", cambie el interruptor a **"Por Lote"**.
2.  Descargue la **Plantilla CSV**.
3.  Rellene el CSV manteniendo el formato (separe medicamentos con punto y coma `;`).
4.  Suba el archivo. La IA procesará fila por fila.
5.  Al finalizar, podrá exportar todos los reportes en un ZIP o un resumen en CSV.

### Dashboard de Farmacovigilancia
*   Vaya a la pestaña **Dashboard**.
*   Visualice estadísticas agregadas: fármacos más problemáticos en su consulta, tipos de interacciones más frecuentes y distribución de riesgos.

### Exportación de Datos
*   Puede descargar cualquier análisis individual como **PDF** (informe) o **CSV** (datos estructurados).
*   Desde la pestaña Historial, puede exportar toda su actividad a CSV.

---

## 4. Guía de Administración (Superuser)

El rol de Administrador tiene acceso a una pestaña exclusiva: **Admin (⚙️)**.

### Configuración de Fuentes de IA
Usted puede controlar en qué fuentes confía el sistema para generar sus respuestas. Esto se inyecta directamente en las instrucciones del modelo ("System Prompt").

1.  **Fuentes Prioritarias:**
    *   Escriba los dominios separados por comas (ej: `nih.gov, mayoclinic.org, aemps.gob.es`).
    *   *Efecto:* La IA intentará basar sus respuestas y citas en estos dominios preferentemente.
    
2.  **Fuentes Excluidas:**
    *   Dominios que la IA debe ignorar (ej: `wikipedia.org, socialmedia.com`).
    *   *Efecto:* Reduce el riesgo de alucinaciones basadas en información no médica.

3.  **Nivel de Seguridad:**
    *   **Standard:** Recomendado. Equilibrio entre utilidad y precaución.
    *   **Strict:** La IA rechazará analizar si detecta la más mínima ambigüedad o riesgo de seguridad (puede generar muchos falsos negativos).
    *   **Loose:** Menos restricciones. Útil solo para investigación teórica avanzada.

### Gestión de Usuarios
Actualmente, la asignación de roles se realiza directamente en la base de datos (Firebase Console).
*   Colección: `users`
*   Documento: `[User UID]`
*   Campo: `role` (valor: `'personal'`, `'professional'`, `'admin'`)

---

## 5. Solución de Problemas Comunes

**Error: "Dominio no autorizado" al iniciar sesión**
*   Esto ocurre si accede desde una URL nueva (ej. una preview de desarrollo).
*   Solución: Copie el dominio que aparece en la pantalla de error y añádalo en Firebase Console -> Authentication -> Settings -> Authorized Domains.
*   *Alternativa:* Si está en desarrollo, use el "Modo Demo".

**Error 429 (Resource Exhausted)**
*   Ha superado la cuota de la API de Gemini. Espere un minuto y reintente.
*   *Nota para Admin:* Considere actualizar el plan de Google AI Studio si esto ocurre frecuentemente en producción.

**Botón "Analizar" deshabilitado**
*   Asegúrese de haber añadido al menos un medicamento y una condición de salud. Son campos obligatorios para el contexto clínico.
