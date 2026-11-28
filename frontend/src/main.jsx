
 // Configurar AWS Cognito
 import "./amplify-config"

 // Importar React y componentes
 import { StrictMode } from "react"
 import { createRoot } from "react-dom/client"
 import { Authenticator } from "@aws-amplify/ui-react"

 // Estilos de Amplify y GymControl
 import "@aws-amplify/ui-react/styles.css"
 import "./index.css"

 import App from "./App.jsx"

 // Proteger GymControl con inicio de sesión
 createRoot(document.getElementById("root")).render(
   <StrictMode>
     <Authenticator hideSignUp loginMechanisms={["username"]}>
  {({ signOut, user }) => (
    <>
      <App />
      <button
        onClick={signOut}
        className="fixed bottom-4 right-4 rounded bg-red-600 px-4 py-2 text-white"
      >
        Cerrar sesión
      </button>
    </>
  )}
</Authenticator>
   </StrictMode>
 )