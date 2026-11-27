
import * as React from "react"

// Iconos para la navegación de GymControl
import {
  DumbbellIcon,
  LayoutDashboardIcon,
  UsersIcon,
  CreditCardIcon,
  ChartBarIcon,
  Settings2Icon,
} from "lucide-react"

// Componentes de navegación de la plantilla
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Configuración temporal del menú y usuario de ejemplo
const data = {
  user: {
    name: "GymControl",
    email: "usuario@ejemplo.com",
    avatar: "",
  },

  // Secciones principales del sistema
  navMain: [
    {
      title: "Inicio",
      url: "#",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Miembros",
      url: "#",
      icon: <UsersIcon />,
    },
    {
      title: "Pagos",
      url: "#",
      icon: <CreditCardIcon />,
    },
    {
      title: "Ingresos",
      url: "#",
      icon: <ChartBarIcon />,
    },
  ],
}

// Menú lateral principal de GymControl
export function AppSidebar({ ...props }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Encabezado del menú */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <DumbbellIcon className="size-5!" />
              <span className="text-base font-semibold">
                GymControl
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Opciones de navegación */}
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      {/* Usuario de ejemplo; después lo conectaremos con Cognito */}
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}