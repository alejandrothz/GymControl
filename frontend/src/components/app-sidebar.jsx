
import * as React from "react"

// Iconos de GymControl
import {
  DumbbellIcon,
  LayoutDashboardIcon,
  UsersIcon,
  CreditCardIcon,
  ChartBarIcon,
} from "lucide-react"

// Componentes de la plantilla shadcn/ui
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

// Configuración del menú y usuario provisional
const data = {
  user: {
    name: "GymControl",
    email: "usuario@ejemplo.com",
    avatar: "",
  },

  // Rutas de navegación de GymControl
  navMain: [
    {
      title: "Inicio",
      url: "#inicio",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Miembros",
      url: "#miembros",
      icon: <UsersIcon />,
    },
    {
      title: "Pagos",
      url: "#pagos",
      icon: <CreditCardIcon />,
    },
    {
      title: "Ingresos",
      url: "#ingresos",
      icon: <ChartBarIcon />,
    },
  ],
}

// Menú lateral principal
export function AppSidebar({ ...props }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Encabezado de GymControl */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#inicio" />}
            >
              <DumbbellIcon className="size-5!" />
              <span className="text-base font-semibold">
                GymControl
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navegación principal */}
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      {/* Usuario provisional */}
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
