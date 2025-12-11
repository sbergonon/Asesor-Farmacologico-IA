
import React, { useEffect } from 'react';
import XIcon from './icons/XIcon';

interface ManualModalProps {
  onClose: () => void;
}

const ManualModal: React.FC<ManualModalProps> = ({ onClose }) => {
  // Close modal on escape key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-labelledby="manual-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <h2 id="manual-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-200">
            Manual de Usuario y Administración
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-slate-700 dark:text-slate-300 space-y-6 text-base leading-relaxed">
            
            <section>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">1. Introducción</h3>
                <p><strong>Asesor Farmacológico IA</strong> es una herramienta de apoyo a la decisión clínica impulsada por Google Gemini. Permite analizar interacciones medicamentosas complejas considerando no solo el cruce fármaco-fármaco, sino también condiciones de salud, alergias, suplementos y genética.</p>
                <div className="mt-3 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold text-sm mb-1">Roles de Usuario:</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                        <li><strong>Personal:</strong> Acceso básico. Puede realizar análisis individuales.</li>
                        <li><strong>Profesional (Pro):</strong> Acceso avanzado. Gestión de pacientes, lotes (CSV), investigador clínico, dashboard y exportación.</li>
                        <li><strong>Admin (Superuser):</strong> Control total. Funciones Pro + Configuración global del sistema.</li>
                    </ul>
                </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">2. Guía para el Usuario Personal</h3>
                <h4 className="text-lg font-semibold mt-3">Realizar un Nuevo Análisis</h4>
                <ol className="list-decimal pl-5 space-y-2 mt-2">
                    <li>Vaya a la pestaña <strong>Nuevo Análisis</strong>.</li>
                    <li><strong>Medicamentos:</strong> Escriba el nombre del fármaco. El sistema autocompletará. Si no aparece, seleccione la opción <em>"Usar [Nombre]"</em>.</li>
                    <li><strong>Alergias:</strong> Indique alergias conocidas (ej. Penicilina).</li>
                    <li><strong>Condiciones:</strong> Escriba enfermedades crónicas.</li>
                    <li>Pulse <strong>Analizar</strong>.</li>
                </ol>
                <h4 className="text-lg font-semibold mt-4">Interpretación de Resultados</h4>
                <p>Busque siempre el <strong>Resumen Crítico</strong> al inicio. Las tarjetas están codificadas por color (Rojo = Alto riesgo).</p>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-2xl font-bold text-teal-600 dark:text-teal-400 mb-2">3. Guía para el Profesional (PRO)</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-lg font-semibold">Gestión de Pacientes</h4>
                        <p className="text-sm">Use la pestaña <strong>Pacientes</strong> para gestionar perfiles. Guarde perfiles desde el formulario principal con el botón "Guardar Perfil".</p>
                    </div>
                    <div>
                        <h4 className="text-lg font-semibold">Análisis por Lote</h4>
                        <p className="text-sm">En "Nuevo Análisis", cambie a <strong>"Por Lote"</strong>. Descargue la plantilla CSV, rellénela (separando meds con <code>;</code>) y súbala para analizar múltiples casos a la vez.</p>
                    </div>
                </div>
                
                <h4 className="text-lg font-semibold mt-4">Investigador Clínico (Nuevo)</h4>
                <p className="text-sm mb-2">
                    La pestaña <strong>Investigador Clínico</strong> permite realizar un razonamiento inverso ("Reverse Pharmacology"). 
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1 mb-2">
                    <li>Utiliza los datos cargados en la pestaña "Nuevo Análisis" (medicamentos, edad, genética).</li>
                    <li>Introduzca un síntoma observado (ej: "Mareos", "Prolongación QT").</li>
                    <li>La IA determinará si el síntoma puede explicarse por efectos adversos, interacciones o factores genéticos del paciente actual.</li>
                </ul>

                <h4 className="text-lg font-semibold mt-4">Dashboard y Exportación</h4>
                <p className="text-sm">
                    Visualice estadísticas en la pestaña Dashboard. Ahora incluye una tabla específica de <strong>Interacciones Críticas Frecuentes</strong>.
                    Exporte reportes individuales a PDF/CSV o el historial completo desde su pestaña correspondiente.
                </p>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">4. Guía de Administración (Superuser)</h3>
                <p>El administrador tiene acceso a la pestaña <strong>Admin (⚙️)</strong>.</p>
                
                <h4 className="text-lg font-semibold mt-3">Configuración de Fuentes</h4>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                    <li><strong>Fuentes Prioritarias:</strong> Dominios que la IA debe preferir (ej: <code>nih.gov, mayoclinic.org</code>).</li>
                    <li><strong>Fuentes Excluidas:</strong> Dominios a ignorar (ej: <code>wikipedia.org</code>).</li>
                    <li><strong>Nivel de Seguridad:</strong> 'Standard' es el recomendado.</li>
                </ul>
            </section>

             <hr className="border-slate-200 dark:border-slate-700" />

            <section>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Solución de Problemas</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Error "Dominio no autorizado":</strong> Copie el dominio del error y añádalo en Firebase Console. O use el "Modo Demo".</li>
                    <li><strong>Error 429:</strong> Cuota de API excedida. Espere un minuto.</li>
                </ul>
            </section>
        </div>

        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
           <button 
            onClick={onClose} 
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Cerrar Manual
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualModal;
