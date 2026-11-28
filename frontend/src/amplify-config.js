
 // Configuración de AWS Amplify con Amazon Cognito
 import { Amplify } from "aws-amplify"

 Amplify.configure({
   Auth: {
     Cognito: {
       // User Pool existente en AWS Ohio
       userPoolId: "us-east-2_wcE38EYL3",

       // Cliente de nuestra aplicación React
       userPoolClientId: "5e47olags4quq51huf7lvb9sr8",
     },
   },
 })
