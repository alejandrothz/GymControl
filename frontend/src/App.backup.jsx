// Importar los estilos del panel GymControl
import './App.css'

// Importar el botón prediseñado de shadcn/ui
import { Button } from '@/components/ui/button'

import { Dumbbell, Users, CreditCard, BarChart3 } from 'lucide-react'

// Componente principal del panel de GymControl
function App() {
  return (
    <div className="dashboard">

      {/* Menú lateral de navegación */}
      <aside className="sidebar">
        <h2><Dumbbell size={24} /> GymControl</h2>

        <nav>
          <button><Users size={18} /> Miembros</button>
          <button><CreditCard size={18} /> Pagos</button>
          <button><BarChart3 size={18} /> Ingresos</button>
        </nav>
      </aside>

      {/* Contenido principal con estilos de Tailwind */}
      <main className="content">
        <h1 className="text-3xl font-bold text-blue-600">
          Panel principal
        </h1>
        <p>Bienvenido al sistema de administración GymControl.</p>
        <Button>Registrar miembro</Button>
      </main>

    </div>
  )
}

// Exportar el componente principal
export default App
