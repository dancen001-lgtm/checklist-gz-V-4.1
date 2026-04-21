/* Preguntas generadas desde: Evaluacion Operativa GZ ajustada (5).xlsx */
/* Total preguntas: 114 */
const QUESTIONS = [
  {
    "id": 1,
    "area": "Área externa",
    "text": "Moppi o Cajas de luces con publicidad vigente a 100Mts."
  },
  {
    "id": 2,
    "area": "Área externa",
    "text": "Limpieza puertas y ventanas de las tiendas"
  },
  {
    "id": 3,
    "area": "Área externa",
    "text": "Puerta principal en buen estado."
  },
  {
    "id": 4,
    "area": "Área externa",
    "text": "Rótulos en buen estado"
  },
  {
    "id": 5,
    "area": "Área externa",
    "text": "Publicidad Vigente"
  },
  {
    "id": 6,
    "area": "Área externa",
    "text": "Limpieza parqueo"
  },
  {
    "id": 7,
    "area": "Área externa",
    "text": "Revision mueble hielo- No congelado - Publicidad adecuada"
  },
  {
    "id": 8,
    "area": "Área externa",
    "text": "Rotulo preventivos ( No consumo de Licor)"
  },
  {
    "id": 9,
    "area": "Área externa",
    "text": "Llaves en buen estado, y según existencia de ATM´s"
  },
  {
    "id": 10,
    "area": "Área interna",
    "text": "Musicalización adecuada de la tienda. Radio AMPM"
  },
  {
    "id": 11,
    "area": "Área interna",
    "text": "Alcohol Liquido disponible"
  },
  {
    "id": 12,
    "area": "Área interna",
    "text": "Temperatura adecuada ( 22 grados )"
  },
  {
    "id": 13,
    "area": "Área interna",
    "text": "Sin chicles en el piso"
  },
  {
    "id": 14,
    "area": "Área interna",
    "text": "Todas las luminarias funcionando correctamente"
  },
  {
    "id": 15,
    "area": "Área interna",
    "text": "Identificar innecesarios y botarlos"
  },
  {
    "id": 16,
    "area": "Área interna",
    "text": "Extintor ubicado correctamente y con señalizacion. - No Vencido"
  },
  {
    "id": 17,
    "area": "Área interna",
    "text": "Ruta de evacuacion definida y rotulada."
  },
  {
    "id": 18,
    "area": "Área interna",
    "text": "Mueble de helados-No congelados"
  },
  {
    "id": 19,
    "area": "Área interna",
    "text": "Personal con porte y aspecto adecuado. Gte y Agentes"
  },
  {
    "id": 20,
    "area": "Área interna",
    "text": "ATM´s con espacios establecidos, despejados"
  },
  {
    "id": 21,
    "area": "Área interna",
    "text": "Cesta de basura ATM limpia"
  },
  {
    "id": 22,
    "area": "Área interna",
    "text": "GT con conocimiento de ahorro energetico"
  },
  {
    "id": 23,
    "area": "Food Service",
    "text": "Mueble de pan limpio e iluminado."
  },
  {
    "id": 24,
    "area": "Food Service",
    "text": "Precios y promociones correctamente exhibidas."
  },
  {
    "id": 25,
    "area": "Food Service",
    "text": "Máquina de café limpia y rellena."
  },
  {
    "id": 26,
    "area": "Food Service",
    "text": "Limpieza debajo de los equipos"
  },
  {
    "id": 27,
    "area": "Food Service",
    "text": "Máquina de Hot Dog limpia y con Salchichas"
  },
  {
    "id": 28,
    "area": "Food Service",
    "text": "Salsera, parte interior limpia."
  },
  {
    "id": 29,
    "area": "Food Service",
    "text": "Temperatura de maquina HD 90F"
  },
  {
    "id": 30,
    "area": "Food Service",
    "text": "Mueble Autoservicio Limpio"
  },
  {
    "id": 31,
    "area": "Food Service",
    "text": "Roll firmado limpieza muebles, mesas, manesillas."
  },
  {
    "id": 32,
    "area": "Food Service",
    "text": "Gavetas limpias y producto ordenado"
  },
  {
    "id": 33,
    "area": "Food Service",
    "text": "Sillas en buen estado"
  },
  {
    "id": 34,
    "area": "Food Service",
    "text": "Mesas Limpias y funcionando adecuadamente (mesas no desniveladas, no chicles)"
  },
  {
    "id": 35,
    "area": "Food Service",
    "text": "Matahambritas con planimetria correcta"
  },
  {
    "id": 36,
    "area": "Food Service",
    "text": "Luces y Temperatura adecuada de MataHambritas"
  },
  {
    "id": 37,
    "area": "Food Service",
    "text": "Inventario adecuado de MH"
  },
  {
    "id": 38,
    "area": "Food Service",
    "text": "Pantallas encendidas y con publicidad vigente"
  },
  {
    "id": 39,
    "area": "Food Service",
    "text": "Matamosca en funcionamiento y lamina no llena"
  },
  {
    "id": 40,
    "area": "Food Service",
    "text": "Limpieza Televisor de FS"
  },
  {
    "id": 41,
    "area": "Licorería",
    "text": "Producto Frenteado"
  },
  {
    "id": 42,
    "area": "Licorería",
    "text": "Planimetria correcta"
  },
  {
    "id": 43,
    "area": "Licorería",
    "text": "Producto con precio exhibido"
  },
  {
    "id": 44,
    "area": "Licorería",
    "text": "Limpieza mueble de licores"
  },
  {
    "id": 45,
    "area": "Licorería",
    "text": "Publicidad en mueble de licores"
  },
  {
    "id": 46,
    "area": "Licorería",
    "text": "Luces encendidas"
  },
  {
    "id": 47,
    "area": "BC",
    "text": "Producto Frenteado"
  },
  {
    "id": 48,
    "area": "BC",
    "text": "Planimetrias correctas"
  },
  {
    "id": 49,
    "area": "BC",
    "text": "Producto con precio exhibido"
  },
  {
    "id": 50,
    "area": "BC",
    "text": "Sin residuos de sellador en puertas y fascias"
  },
  {
    "id": 51,
    "area": "BC",
    "text": "Luces encendidas"
  },
  {
    "id": 52,
    "area": "BC",
    "text": "Temperatura adecuada (0-5 grados C)"
  },
  {
    "id": 53,
    "area": "BC",
    "text": "Publicidad vigente BC ."
  },
  {
    "id": 54,
    "area": "BC",
    "text": "Piso limpio, no quebrado."
  },
  {
    "id": 55,
    "area": "BC",
    "text": "Limpieza Racks de BC"
  },
  {
    "id": 56,
    "area": "BC",
    "text": "Limpieza estantes de BC."
  },
  {
    "id": 57,
    "area": "CF",
    "text": "Limpieza debajo de cada puerta."
  },
  {
    "id": 58,
    "area": "CF",
    "text": "Producto Frenteado"
  },
  {
    "id": 59,
    "area": "CF",
    "text": "Planimetrias correctas"
  },
  {
    "id": 60,
    "area": "CF",
    "text": "Producto con precio exhibido"
  },
  {
    "id": 61,
    "area": "CF",
    "text": "Empaques de CF Y BC en buen estado y limpios"
  },
  {
    "id": 62,
    "area": "CF",
    "text": "Sin residuos de sellador en puertas y fascias"
  },
  {
    "id": 63,
    "area": "CF",
    "text": "Luces encendidas"
  },
  {
    "id": 64,
    "area": "CF",
    "text": "Temperatura adecuada ( 32-40 grados  Fahrenheit/ 0-5 grados C)"
  },
  {
    "id": 65,
    "area": "CF",
    "text": "Bodega identificada con rotulos por proveedor"
  },
  {
    "id": 66,
    "area": "CF",
    "text": "Producto vencido rotulado"
  },
  {
    "id": 67,
    "area": "CF",
    "text": "Carritos de CF frenteado"
  },
  {
    "id": 68,
    "area": "CF",
    "text": "Control de temperatura actualizada."
  },
  {
    "id": 69,
    "area": "CF",
    "text": "Piso limpio, no quebrado."
  },
  {
    "id": 70,
    "area": "CF",
    "text": "Limpieza de deslizadores de CF"
  },
  {
    "id": 71,
    "area": "CF",
    "text": "Chaqueta de Cuarto frio, limpia, en buen estado y en su lugar correspondiente (Bodega)."
  },
  {
    "id": 72,
    "area": "Góndolas",
    "text": "Frenteo y Relleno de cabeceras de góndolas"
  },
  {
    "id": 73,
    "area": "Góndolas",
    "text": "Limpieza bajo los equipos ( Congeladores) sin mechas de lampazo en las esquinas."
  },
  {
    "id": 74,
    "area": "Góndolas",
    "text": "Verificar Planimetrias gondolas 1-2-3"
  },
  {
    "id": 75,
    "area": "Góndolas",
    "text": "Canastas en existencia 5 y limpias"
  },
  {
    "id": 76,
    "area": "Góndolas",
    "text": "Exhibicion y Precios en cabecera y gondolas"
  },
  {
    "id": 77,
    "area": "Góndolas",
    "text": "Promociones Rotuladas"
  },
  {
    "id": 78,
    "area": "Góndolas",
    "text": "Sin promociones no vigentes"
  },
  {
    "id": 79,
    "area": "Góndolas",
    "text": "Publicidad vigente en los laterales de las cabeceras"
  },
  {
    "id": 80,
    "area": "Góndolas",
    "text": "No residuos de tape doble contacto en paredes y góndolas."
  },
  {
    "id": 81,
    "area": "Góndolas",
    "text": "Pasillos despejados y si hay producto deben estar en su respectivo polín."
  },
  {
    "id": 82,
    "area": "Góndolas",
    "text": "Verificación de Precios en Góndolas"
  },
  {
    "id": 83,
    "area": "Caja",
    "text": "Área de Cigarros Rellena y preciada"
  },
  {
    "id": 84,
    "area": "Caja",
    "text": "Puertas en buen estado"
  },
  {
    "id": 85,
    "area": "Caja",
    "text": "Gavetas Ordenadas"
  },
  {
    "id": 86,
    "area": "Caja",
    "text": "Mueble trasero de Caja Limpio y Ordenado"
  },
  {
    "id": 87,
    "area": "Caja",
    "text": "Sin residuos  de sellador"
  },
  {
    "id": 88,
    "area": "Caja",
    "text": "Caja fuerte sin llave y resguardo hechos"
  },
  {
    "id": 89,
    "area": "Caja",
    "text": "Planimetria correcta frente de caja"
  },
  {
    "id": 90,
    "area": "Caja",
    "text": "Pantallas encendidas y con publicidad vigente"
  },
  {
    "id": 91,
    "area": "Caja",
    "text": "Cajas registradoras en buen estado."
  },
  {
    "id": 92,
    "area": "Caja",
    "text": "Acrílicos área de Caja, limpios."
  },
  {
    "id": 93,
    "area": "Caja",
    "text": "Áreas de caja Ordenada, sin publicidad no autorizada."
  },
  {
    "id": 94,
    "area": "Caja",
    "text": "Lampara de mano en buen estado para apagones"
  },
  {
    "id": 95,
    "area": "Caja",
    "text": "Permisos vigentes y visibles (MINSA, Policía, Bomberos, Matrícula Alcaldía, Intur)"
  },
  {
    "id": 96,
    "area": "Baño",
    "text": "Lavamanos limpio y descurtido"
  },
  {
    "id": 97,
    "area": "Baño",
    "text": "Inodoro limpio y descurtido"
  },
  {
    "id": 98,
    "area": "Baño",
    "text": "Espejo limpio (no pringado)"
  },
  {
    "id": 99,
    "area": "Baño",
    "text": "Jabón de manos disponible"
  },
  {
    "id": 100,
    "area": "Baño",
    "text": "Papel Higiénico disponible"
  },
  {
    "id": 101,
    "area": "Baño",
    "text": "Papel toalla disponible"
  },
  {
    "id": 102,
    "area": "Baño",
    "text": "Papelera limpia y no llena"
  },
  {
    "id": 103,
    "area": "Baño",
    "text": "Control de baño actualizado"
  },
  {
    "id": 104,
    "area": "Baño",
    "text": "Luminaria y extractor funcionando"
  },
  {
    "id": 105,
    "area": "Baño",
    "text": "Luces apagadas"
  },
  {
    "id": 106,
    "area": "Baño",
    "text": "Lockers con cerraduras, en buen estado"
  },
  {
    "id": 107,
    "area": "Baño",
    "text": "Sin filtraciones o fugas de agua"
  },
  {
    "id": 108,
    "area": "Baño",
    "text": "Lugar definido para equipo de limpieza, equipo limpio y sin mal olor."
  },
  {
    "id": 109,
    "area": "Baño",
    "text": "Lavandero sin Moho"
  },
  {
    "id": 110,
    "area": "Bodega",
    "text": "Área ordenada y limpia"
  },
  {
    "id": 111,
    "area": "Bodega",
    "text": "Paneles electricos despejados y sin cajas que obstruyan el paso."
  },
  {
    "id": 112,
    "area": "Bodega",
    "text": "Producto vencido rotulado y en el lugar destinado"
  },
  {
    "id": 113,
    "area": "Bodega",
    "text": "Luces apagadas"
  },
  {
    "id": 114,
    "area": "Bodega",
    "text": "Rotulacion de Ingreso solo personal autorizado"
  }
];

if (typeof window !== 'undefined') window.QUESTIONS = QUESTIONS;
