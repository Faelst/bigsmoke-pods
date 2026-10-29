export const SITE = {
  name: "Big Smoke Pods",
  whatsappNumber: "5512996190474",
  instagram: "bigsmokepods.oficial",
  instagramUrl: "https://www.instagram.com/bigsmokepods.oficial",
};

export function whatsappLink(text = "👋 Olá, venho do site Big Smoke Pods!\nEu quero fazer o próximo pedido:\n") {
  return `https://api.whatsapp.com/send?phone=${SITE.whatsappNumber}&text=${encodeURIComponent(text)}`;
}
