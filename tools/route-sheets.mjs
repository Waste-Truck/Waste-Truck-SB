// District 5 route sheets for Barangay San Bartolome, transcribed from the
// photos in "/schedules and area". One entry per route; `sections` are the
// subdivisions/compounds in the order printed, with the streets listed under each.
// Spellings follow the sheets (alternate map spellings are added after "|").

export const ROUTES = [
  { route: "BC-05-53", truck: "208", type: "FDTL", remarks: "MWF", sections: [
    { name: "Kathleen Place IV", streets: ["S. Francisco|San Francisco", "Alfred", "Bayani", "Nougera|Noguera", "Ibarra", "Carlos", "Carlos Extension"] },
  ]},
  { route: "BC-05-54", truck: "208", type: "FDTL", remarks: "TThS (with Sunday collection)", sections: [
    { name: "Nomar Homes I", streets: ["Pisces", "Scorpio", "Taurus", "Aries", "Dizon", "Evangelista"] },
    { name: "Princess Homes", streets: [] },
    { name: "Nomar Homes II", streets: ["Sampaguita", "Rosal", "Santan", "Waling-Waling|Waling Waling", "Camia", "Dahlia"] },
  ]},
  { route: "BC-05-55", truck: "135", type: "FDTL", remarks: "Merged with BC-05-56 Wed to Sat (with Sunday collection)", sections: [
    { name: "San Pedro VII", streets: ["St. Peter", "St. Michael", "St. John", "St. Anthony", "St. Thomas", "St. James", "St. Andrew", "St. Jude", "St. Philip", "St. Simon", "St. Thaddeus"] },
    { name: "St. Francis Village", streets: ["Assisi", "Grecio|Greccio", "Perciuncula|Porciuncula", "Perugria|Perugia", "Laverna|La Verna", "Escoleto|Spoleto"] },
    { name: "Rolling Meadows I", streets: ["Meadows I Ave|Meadows Avenue|Meadows", "Magnolia", "Sweet Pea", "Daisy", "Gumamela", "Rose", "Tulip", "Orchids|Orchid", "Marigold", "Lilac", "Lily"] },
  ]},
  { route: "BC-05-56", truck: "135", type: "FDTL", remarks: "2nd trip", sections: [
    { name: "Rolling Meadows II", streets: ["Meadows II Ave|Meadows 2", "Eagle", "Condor", "Gannet", "Cardinal", "Dove", "Vulture", "Martin", "Lovebird", "Sparrow", "Woodpecker", "Kingfisher", "Nightingale", "Blue Jay|Bluejay", "Flamingo", "Swallow", "Seagull", "Hummingbird"] },
    { name: "Samabako", streets: [] },
    { name: "Sweet Meadows", streets: [] },
    { name: "Rolling Meadows III", streets: [] },
    { name: "Pascualers", streets: [] },
  ]},
  { route: "BC-05-57", truck: "237", type: "GC", remarks: "Wed & Sat include San Bartolome Elementary School", sections: [
    { name: "Rainbow Homes I", streets: ["Rainbow Ave|Rainbow Avenue", "Blue Bird|Bluebird", "Silver Gull", "Black Quail", "Gray Parrot|Grey Parrot", "Yellow Bird", "Golden Peacock", "Red Macau|Red Macaw", "Pink Flamingo", "Green Peasant|Green Pheasant", "Mocking Bird|Mockingbird", "White Duck", "Sugar Bird"] },
    { name: "Rainbow Homes II", streets: ["Narra", "Guijo|Gujio", "Kamagong", "Acacia", "Tanguile", "Yakal", "Dao", "Mahogany", "Metro Green Avenue|Metro"] },
    { name: "Metro Green Village", streets: ["Block 1", "Block 2", "Block 3", "Block 4", "Block 5", "Block 6", "Block 7", "Block 8", "Block 9", "Block 10", "Block 11", "Block 12", "Block 13", "Block 14", "Block 15"] },
  ]},
  { route: "BC-05-58", truck: "137", type: "FDTL", remarks: "MWF", sections: [
    { name: "Carreon Village", streets: ["1st St|First Street", "2nd St|Second Street"] },
    { name: "Carreon/Aguirre Compound", streets: [] },
    { name: "Gawad Kalinga/Baluarte", streets: [] },
    { name: "San Bartolome de Novaliches Parish", streets: [] },
    { name: "R.T. Gonzales", streets: ["Kappa", "Beta", "Gamma", "Omicron"] },
    { name: "SB Residence", streets: [] },
    { name: "Green Heights Subdivision", streets: ["Jade", "Emerald", "Pearl", "Diamond Ave|Diamond", "Amethyst Ave|Amethyst", "Opal", "Ruby", "Sapphire", "Topaz", "Zircon"] },
    { name: "Banal Compound", streets: [] },
  ]},
  { route: "BC-05-59", truck: "137", type: "FDTL", remarks: "TThS (with Sunday collection)", sections: [
    { name: "Rockville I", streets: ["Rockville Ave|Rockville Avenue", "Emerald", "Diamond", "Silver", "Gold"] },
    { name: "Rockville II", streets: ["Jade", "Sapphire", "Crystal", "Pearl", "Onyx", "Amethyst", "Topaz"] },
    { name: "P. Dela Cruz (Quirino Hi-way to Odelco)", streets: ["P. Dela Cruz|Pablo dela Cruz"], near: [14.7045, 121.0338] },
    { name: "Holy Cross Road", streets: ["Holy Cross Road|Holy Cross"] },
  ]},
  { route: "BC-05-60", truck: "109", type: "MDT", remarks: "2nd trip", sections: [
    { name: "P. Dela Cruz (Odelco to North Point Park)", streets: ["P. Dela Cruz|Pablo dela Cruz"], near: [14.7085, 121.0318] },
    { name: "Odelco Subdivision", streets: ["Rainbow", "Emerald", "Pink", "Orange", "Violet", "Blue", "Green", "Ivory"] },
    { name: "Odelco Elementary School", streets: [] },
    { name: "Philips North Point Park", streets: ["North Point", "First Point", "Square Point", "Center Point", "East Point", "View Point", "West Point", "South Point"] },
    { name: "ACF Subdivision", streets: ["ACF Road|ACF", "Aries", "Virgo", "Leo", "Gemini", "Taurus", "Libra"] },
  ]},
  { route: "BC-05-61", truck: "166", type: "GC", remarks: "Monday", sections: [
    { name: "175 P. Dela Cruz / Acme Road", streets: ["Acme Road|Acme"] },
    { name: "Ramos Compound", streets: [] },
    { name: "De Guzman Compound", streets: [] },
    { name: "A. Ramirez", streets: ["A. Ramirez|Ramirez"] },
    { name: "Ianjan Compound", streets: [] },
    { name: "P. Dela Cruz (Acme Road to Maries Gate)", streets: ["P. Dela Cruz|Pablo dela Cruz"], near: [14.7115, 121.0275] },
    { name: "Gawad Kalinga/New Jersey", streets: [] },
    { name: "Valentin Compound", streets: [] },
  ]},
  { route: "BC-05-62", truck: "166", type: "GC", remarks: "Tuesday (merged with BC-05-61 Wed to Sat)", sections: [
    { name: "Atlas Road", streets: ["Atlas Road|Atlas"] },
    { name: "Margarita Compound", streets: [] },
    { name: "Sikatuna Country Homes", streets: ["Ramirez Street|Ramirez", "Lapu-Lapu|Lapu Lapu", "Garcia Extension|Garcia"] },
    { name: "Good Haven", streets: [] },
    { name: "Bana Compound", streets: ["Angela", "Peter Street|Peter"] },
  ]},
  { route: "BC-05-63", truck: "118", type: "GCM", remarks: "Monday", sections: [
    { name: "Doña Faustina Subdivision", streets: ["Osmeña|Osmena", "Recto", "Roxas", "Marcos", "Quezon", "Quirino"] },
    { name: "Gawad Kalinga", streets: ["Macapagal", "Garcia", "Oregon", "Aguinaldo", "JP Rizal|J.P. Rizal|Rizal", "Bonifacio", "Arellano"] },
  ]},
  { route: "BC-05-64", truck: "118", type: "GCM", remarks: "Tuesday (merged with BC-05-63 Wed to Sat)", sections: [
    { name: "Green Acres Subdivision", streets: ["Madre Cacao|Madre de Cacao", "Mulawin", "Aratiles", "Narra"] },
    { name: "Maries Subdivision", streets: ["St. Andrew", "St. Jude", "St. Philip", "St. Mark", "St. Matthew", "St. John", "St. Peter", "St. James", "St. Paul", "St. Joseph", "St. Bartolome|St. Bartholomew", "Riverside", "Magsaysay Ave|Magsaysay"] },
    { name: "Severino Compound", streets: [] },
    { name: "Lapuz Compound", streets: ["Calugas", "Villamor"] },
    { name: "Visayas Compound", streets: [] },
  ]},
  { route: "BC-05-65", truck: "213", type: "FDTL", remarks: "Monday", sections: [
    { name: "California Village", streets: ["Katipunan Avenue|Katipunan"], near: [14.7115, 121.0209] },
    { name: "Sambahayanang California", streets: [] },
    { name: "California Dreamhomes", streets: ["East Los Angeles", "Sta. Cruz|Santa Cruz", "East Berkely|East Berkeley", "West Los Angeles", "Riverside Ave|Riverside", "Davies Ave|Davies|Davis", "West Berkely|West Berkeley"] },
    { name: "California Ville Townhouse", streets: ["San Jose", "Sta. Maria|Santa Maria", "West Fresno", "East Fresno"] },
  ]},
  { route: "BC-05-66", truck: "213", type: "FDTL", remarks: "Tuesday (merged with BC-05-65 Wed to Sat)", sections: [
    { name: "Good Will Homes I", streets: ["Amity", "Benevolence", "Courage", "Humility", "Diligent|Diligence", "Efficience|Efficiency", "Goodwill Ave|Goodwill", "Faith", "Industrious", "Joy", "Generosity", "Helpful", "Charity", "Luck", "Love", "Obedience", "Kindness", "Purity", "Justice"] },
  ]},
];
