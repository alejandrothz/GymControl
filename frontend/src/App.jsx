
 // Importar los componentes del dashboard
 import { AppSidebar } from "@/components/app-sidebar"
 import { SiteHeader } from "@/components/site-header"
 import { SectionCards } from "@/components/section-cards"

 // Importar el contenedor que controla el menú lateral
 import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

 // Componente principal de GymControl
 function App() {
   return (
     <SidebarProvider>
       {/* Menú lateral de la plantilla */}
       <AppSidebar />

       {/* Área principal del dashboard */}
       <SidebarInset>
         <SiteHeader />

         <main className="flex flex-col gap-6 p-6">
           {/* Tarjetas con estadísticas de ejemplo */}
           <SectionCards />
         </main>
       </SidebarInset>
     </SidebarProvider>
   )
 }

 export default App
