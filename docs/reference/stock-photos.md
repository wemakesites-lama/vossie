# Stock photos

Free photos from [Unsplash](https://unsplash.com), downloaded 2026-10-29 and cropped to each slot's ratio (homepage spec
section 12). On 2026-11-05, 47 listings got a cover of their own (`listing/<id>.jpg`, 1200 by 1200, chosen so no photo
appears twice anywhere on the site); the six others keep their category's cover, which no other listing uses. They stand in until Eduvos and the sellers supply real ones. Files live in `public/stock/<folder>/`.

- **Licence:** the [Unsplash Licence](https://unsplash.com/license): free for commercial use, no permission or credit
  required (credit is given here anyway). Photos may not be sold unchanged or used to build a competing photo service.
- **No model releases.** Unsplash doesn't promise one, so photos with faces (the hero, some Hub covers) mustn't present
  a real person as an Eduvos student or a CampusCart seller. Replace them with consented photos before go-live
  (spec section 12, POPIA).
- **Not stock:** the campus photos (below). A listing's second and third photos stay placeholders
  (`public/placeholders/photo/`).
- **Swapping one:** drop a new `.jpg` at the same path and update its row below. A new slot needs its fixture's `src`
  and, for shops, listings and Hub posts on Supabase, the seed (`pnpm db:seed`).

| File | Photo | Photographer |
|---|---|---|
| `hero/textbooks.jpg` | [person carrying four assorted title books on head](https://unsplash.com/photos/person-carrying-four-assorted-title-books-on-head--hx4IFNQcZU) | [Suad Kamardeen](https://unsplash.com/@suadkamardeen) |
| `hero/tech.jpg` | [woman using laptop in workspace HA](https://unsplash.com/photos/woman-using-laptop-in-workspace-HA-0i0E7sq4) | [Daniel Thomas](https://unsplash.com/@spintracer) |
| `hero/services.jpg` | [a woman getting her hair cut by a woman in a red shirt](https://unsplash.com/photos/a-woman-getting-her-hair-cut-by-a-woman-in-a-red-shirt-dRL3IE5N1X8) | [Patrick Marah](https://unsplash.com/@pamarah) |
| `category/textbooks-notes.jpg` | [clear framed eyeglasses on top of pile of books](https://unsplash.com/photos/clear-framed-eyeglasses-on-top-of-pile-of-books-apcUIqOPEIo) | [Kari Shea](https://unsplash.com/@karishea) |
| `listing/textbooks-notes.jpg` | [pile of assorted title books](https://unsplash.com/photos/pile-of-assorted-title-books-xY55bL5mZAM) | [Daria Nepriakhina](https://unsplash.com/@epicantus) |
| `category/tech.jpg` | [black wireless headphones between apple keyboard and apple magic mouse on white surface](https://unsplash.com/photos/black-wireless-headphones-between-apple-keyboard-and-apple-magic-mouse-on-white-surface-YDZPdqv3FcA) | [Tomasz Gawłowski](https://unsplash.com/@gawlowski) |
| `listing/tech.jpg` | [calculator and office supplies on a desk](https://unsplash.com/photos/calculator-and-office-supplies-on-a-desk-54bvLAWhWAM) | [maks_d](https://unsplash.com/@maks_d) |
| `category/res-living.jpg` | [black metal bunk bed](https://unsplash.com/photos/black-metal-bunk-bed-WQJvWU_HZFo) | [Marcus Loke](https://unsplash.com/@marcusloke) |
| `listing/res-living.jpg` | [empty chair](https://unsplash.com/photos/empty-chair-oKHHspCSWHQ) | [sakana](https://unsplash.com/@sakana98) |
| `category/fashion-thrift.jpg` | [assorted color clothes lot hanging on wooden wall rack](https://unsplash.com/photos/assorted-color-clothes-lot-hanging-on-wooden-wall-rack-ojZ4wJNUM5w) | [Fujiphilm](https://unsplash.com/@fujiphilm) |
| `listing/fashion-thrift.jpg` | [assorted clothes in wooden hangers dlxLGIy](https://unsplash.com/photos/assorted-clothes-in-wooden-hangers-dlxLGIy-2VU) | [Priscilla Du Preez](https://unsplash.com/@priscilladupreez) |
| `category/food.jpg` | [a box of cupcakes with pink frosting](https://unsplash.com/photos/a-box-of-cupcakes-with-pink-frosting-m5XCLl69Sus) | [Joshua Glass](https://unsplash.com/@joshuaglass) |
| `listing/food.jpg` | [cupcakes with white icing and green and pink icing on top](https://unsplash.com/photos/cupcakes-with-white-icing-and-green-and-pink-icing-on-top-zURPcpLoKA4) | [Meritt Thomas](https://unsplash.com/@merittthomas) |
| `category/hair-beauty.jpg` | [a shelf filled with lots of different types of hair products](https://unsplash.com/photos/a-shelf-filled-with-lots-of-different-types-of-hair-products-3T2HhfFwEog) | [Daniel](https://unsplash.com/@unsplashbydan) |
| `listing/hair-beauty.jpg` | [hands braiding hair into small square sections](https://unsplash.com/photos/hands-braiding-hair-into-small-square-sections-IQSE1PF18Qo) | [Mohamed B.](https://unsplash.com/@bangscreative) |
| `category/tutoring.jpg` | [woman using macbook](https://unsplash.com/photos/woman-using-macbook-pc_HmXZ0e_w) | [Van Tay Media](https://unsplash.com/@vantaymedia) |
| `listing/tutoring.jpg` | [a woman is holding a pencil and looking at a book](https://unsplash.com/photos/a-woman-is-holding-a-pencil-and-looking-at-a-book-iaJ6xi44LTU) | [shraga kopstein](https://unsplash.com/@sfkopstein) |
| `category/services.jpg` | [man repairing android smartphone](https://unsplash.com/photos/man-repairing-android-smartphone-K7OUs6y_cm8) | [Clint Bustrillos](https://unsplash.com/@clintbustrillos) |
| `listing/services.jpg` | [a person in blue gloves holding a cell phone](https://unsplash.com/photos/a-person-in-blue-gloves-holding-a-cell-phone-y2QUqmEzjzA) | [Vitalijus](https://unsplash.com/@vi_kalinka) |
| `category/tickets-events.jpg` | [concert photos](https://unsplash.com/photos/concert-photos-NcdG9mK3PBY) | [Nainoa Shizuru](https://unsplash.com/@nainoa) |
| `listing/tickets-events.jpg` | [person performing heart hand gesture](https://unsplash.com/photos/person-performing-heart-hand-gesture-hzgs56Ze49s) | [Anthony Delanoix](https://unsplash.com/@anthonydelanoix) |
| `category/stationery.jpg` | [a blue notebook and a pen on a blue surface](https://unsplash.com/photos/a-blue-notebook-and-a-pen-on-a-blue-surface-ReYnnUhN0DA) | [Cinthya González](https://unsplash.com/@cinthyagonzalez) |
| `listing/stationery.jpg` | [fountain pen on spiral book](https://unsplash.com/photos/fountain-pen-on-spiral-book-xG8IQMqMITM) | [Aaron Burden](https://unsplash.com/@aaronburden) |
| `listing/l-003.jpg` | [For Bar fridge, 90 litres](https://unsplash.com/photos/Rjnzt2wvMQE) | Alexander Mass |
| `listing/l-006.jpg` | [For Desk lamp with a USB port](https://unsplash.com/photos/3A4XZUopCJA) | Andrej Lišakov |
| `listing/l-007.jpg` | [For Gaming headset, barely used](https://unsplash.com/photos/w5m3PIGvkqI) | Fausto Sandoval |
| `listing/l-008.jpg` | [For Business Management 1 summary notes](https://unsplash.com/photos/HNjWq8WPyoY) | Yen Vu |
| `listing/l-010.jpg` | [For Denim jacket, size M](https://unsplash.com/photos/QRN47la37gw) | Caio Coelho |
| `listing/l-011.jpg` | [For Logo design for your hustle](https://unsplash.com/photos/pivAQkvM2v0) | Sunil kumar |
| `listing/l-013.jpg` | [For Python tutoring for beginners, one hour](https://unsplash.com/photos/QkYZsgJt9Rg) | Daniil Komov |
| `listing/l-014.jpg` | [For Electric kettle, 1.7 litres](https://unsplash.com/photos/pVD5AIpHNhU) | engin akyurt |
| `listing/l-015.jpg` | [For Thrifted puffer jacket](https://unsplash.com/photos/92_tCTr9rtw) | CGXL MEDIA |
| `listing/l-016.jpg` | [For Lash extensions, classic set](https://unsplash.com/photos/GEct9d7zgos) | Milky Way Lashes |
| `listing/l-017.jpg` | [For Graph paper and highlighter bundle](https://unsplash.com/photos/DL75KgoK1S8) | andrew davies |
| `listing/l-018.jpg` | [For HP laptop charger, 65W](https://unsplash.com/photos/k10a3PdimMg) | Andrey Matveev |
| `listing/l-019.jpg` | [For Economics 1 textbook](https://unsplash.com/photos/MGFSDF4o1nE) | Aziz Jus |
| `listing/l-020.jpg` | [For Mini oven for res](https://unsplash.com/photos/wnqJcgJXHXk) | Marcos Ramírez |
| `listing/l-021.jpg` | [For Bicycle, 21 gears](https://unsplash.com/photos/1ow9zrlldJU) | Patrick Hendry |
| `listing/l-022.jpg` | [For Film camera, working](https://unsplash.com/photos/_T4w3JDm6ug) | Yoann Siloine |
| `listing/l-023.jpg` | [For Gel nails, full set](https://unsplash.com/photos/mciNDxIq4J0) | Julia Schuwer |
| `listing/l-024.jpg` | [For Bunny chow lunch special](https://unsplash.com/photos/eEWlcfydzQ4) | Sanket Shah |
| `listing/l-025.jpg` | [For Accounting 2 tutor, two hours](https://unsplash.com/photos/0oZpRxG5Hkk) | Kelly Sikkema |
| `listing/l-026.jpg` | [For Sharp scientific calculator](https://unsplash.com/photos/aqB6_P5Z_Lg) | Teuku Fadhil |
| `listing/l-027.jpg` | [For Res curtains, two panels](https://unsplash.com/photos/SlpsgiZsSNk) | Jon Tyson |
| `listing/l-028.jpg` | [For Rugby jersey, size L](https://unsplash.com/photos/0CZbu1JNgII) | Wilson Stratton |
| `listing/l-029.jpg` | [For Engineering drawing set](https://unsplash.com/photos/aAoIy--0ZCk) | Andrey Soldatov |
| `listing/l-030.jpg` | [For CV and LinkedIn makeover](https://unsplash.com/photos/7iSEHWsxPLw) | Markus Winkler |
| `listing/l-031.jpg` | [For Spreadsheet tutoring over video](https://unsplash.com/photos/9fZuqBYlV1w) | Gorilla ROI Data Connector |
| `listing/fs-001.jpg` | [For Business Management 1 notes](https://unsplash.com/photos/zwEwkE63ePg) | Tim Wildsmith |
| `listing/fs-002.jpg` | [For Desk lamp, swap for a kettle](https://unsplash.com/photos/at5-1nW3UCY) | Oscar Ivan Esquivel Arte |
| `listing/fs-003.jpg` | [For Res curtains, two panels](https://unsplash.com/photos/0zEfS8Ar4es) | EZcurtain Life |
| `listing/fs-004.jpg` | [For Logo design for a photo shoot](https://unsplash.com/photos/eVpZxkNY3bw) | Onkar Mehta |
| `listing/fs-005.jpg` | [For Hangers, bag of 20](https://unsplash.com/photos/O0j9EivTKfI) | Andrej Lišakov |
| `listing/fs-006.jpg` | [For Calculator for a textbook](https://unsplash.com/photos/wBKWM-DLhzg) | Behnam Norouzi |
| `listing/fs-007.jpg` | [For Highlighters, half used](https://unsplash.com/photos/7r7-7RLdwCU) | Clayton Robbins |
| `listing/dm-001.jpg` | [For Lenovo ThinkPad T480, 8 GB RAM](https://unsplash.com/photos/Tiy7aJwWPvc) | Eddie Sennov |
| `listing/dm-002.jpg` | [For Wireless keyboard and mouse](https://unsplash.com/photos/16GqbwZPULU) | Tubagus Andri Maulana |
| `listing/dm-003.jpg` | [For Phone tripod with a Bluetooth remote](https://unsplash.com/photos/FWfbFYx55lc) | M Sohaib |
| `listing/dm-004.jpg` | [For Canon camera with a tripod](https://unsplash.com/photos/4M4qd2Qq8Ww) | iMattSmart |
| `listing/dm-005.jpg` | [For Sony headphones and a phone case](https://unsplash.com/photos/dJt4lxWy5nk) | Michael Soledad |
| `listing/dm-006.jpg` | [For Casio fx-82ZA Plus calculator](https://unsplash.com/photos/sUU5rv3n9sw) | Gavin Allanwood |
| `listing/dm-007.jpg` | [For Accounting 1A past papers and memos](https://unsplash.com/photos/cbEvoHbJnIE) | Nguyen Dang Hoang Nhu |
| `listing/dm-008.jpg` | [For Statistics 1 textbook, 3rd edition](https://unsplash.com/photos/oB2aEeE8s4A) | Lewis Keegan |
| `listing/dm-009.jpg` | [For Moving boxes, bundle of 10](https://unsplash.com/photos/DevJkLB3hWE) | Kadarius Seegars |
| `listing/dm-010.jpg` | [For Pink velvet cupcakes, box of six](https://unsplash.com/photos/txdFwKqb4a4) | Esra Afşar |
| `listing/dm-011.jpg` | [For Wash day and deep treatment](https://unsplash.com/photos/v3MpM7n2iOE) | Ela De Pure |
| `listing/dm-012.jpg` | [For Event posters and social posts](https://unsplash.com/photos/gFD3BQ-aoyI) | Jonathan Slater |
| `listing/dm-013.jpg` | [For Maths 1 crash course, two hours](https://unsplash.com/photos/gYrYa37fAKI) | Artturi Jalli |
| `listing/dm-014.jpg` | [For White sneakers, size 7](https://unsplash.com/photos/x5aavOm7PFc) | Brian Hall |
| `listing/dm-015.jpg` | [For Comedy night tickets, a pair](https://unsplash.com/photos/imlD5dbcLM4) | Tim Mossholder |
| `collection/start-of-semester.jpg` | [a group of people walking on a road](https://unsplash.com/photos/a-group-of-people-walking-on-a-road-YzXF_ZxH8MM) | [Meredith Spencer](https://unsplash.com/@meredithspencer22) |
| `collection/exam-season.jpg` | [a person writing on a notebook with colored pens](https://unsplash.com/photos/a-person-writing-on-a-notebook-with-colored-pens-OEvLi8LM7cc) | [American Jael](https://unsplash.com/@americanjael) |
| `collection/moving-in.jpg` | [a woman moving boxes in a living room](https://unsplash.com/photos/a-woman-moving-boxes-in-a-living-room-wS40ELZROLE) | [Vitaly Gariev](https://unsplash.com/@silverkblack) |
| `collection/skills-for-hire.jpg` | [person using macbook pro on white table](https://unsplash.com/photos/person-using-macbook-pro-on-white-table-ejhjSZKTeeg) | [Roberto Cortese](https://unsplash.com/@robertocortese) |
| `hub/banner.jpg` | [man using black laptop computer](https://unsplash.com/photos/man-using-black-laptop-computer-kwzWjTnDPLk) | [disruptxn](https://unsplash.com/@disruptxn) |
| `hub/h-001.jpg` | [man standing on stage](https://unsplash.com/photos/man-standing-on-stage-S3hhrqLrgYM) | [Product School](https://unsplash.com/@productschool) |
| `hub/h-010.jpg` | [man standing in stage beside blue curtain](https://unsplash.com/photos/man-standing-in-stage-beside-blue-curtain-lVTtqIY6pL0) | [Product School](https://unsplash.com/@productschool) |
| `hub/h-002.jpg` | [a group of people sitting around a wooden table](https://unsplash.com/photos/a-group-of-people-sitting-around-a-wooden-table-v7XG_VbVABM) | [Sweet Life](https://unsplash.com/@sweetlifediabetes) |
| `hub/h-007.jpg` | [mother and daughter studying together at a table](https://unsplash.com/photos/mother-and-daughter-studying-together-at-a-table-_Am5E9vcsu8) | [Vitaly Gariev](https://unsplash.com/@silverkblack) |
| `hub/h-012.jpg` | [person writing on white paper](https://unsplash.com/photos/person-writing-on-white-paper-GJao3ZTX9gU) | [Cytonn Photography](https://unsplash.com/@cytonn_photography) |
| `hub/h-019.jpg` | [a woman sitting at a counter in a store](https://unsplash.com/photos/a-woman-sitting-at-a-counter-in-a-store-EOkN2pRjFsg) | [Ali Mkumbwa](https://unsplash.com/@mkumbwajr) |
| `hub/h-020.jpg` | [man standing in front of group of men](https://unsplash.com/photos/man-standing-in-front-of-group-of-men-rxpThOwuVgE) | [Austin Distel](https://unsplash.com/@austindistel) |
| `hub/h-021.jpg` | [man presenting in office workspace](https://unsplash.com/photos/man-presenting-in-office-workspace-wMRIcT86SWU) | [Matthew Osborn](https://unsplash.com/@matthewosborn) |
| `hub/h-022.jpg` | [four paper card tags](https://unsplash.com/photos/four-paper-card-tags-KaeaUITiWnc) | [Angèle Kamp](https://unsplash.com/@angelekamp) |
| `hub/h-003.jpg` | [outdoor market stalls with flowers and produce](https://unsplash.com/photos/outdoor-market-stalls-with-flowers-and-produce-HAv3GZoMekw) | [Annie Spratt](https://unsplash.com/@anniespratt) |
| `hub/h-008.jpg` | [outdoor flea market with tables of assorted goods](https://unsplash.com/photos/outdoor-flea-market-with-tables-of-assorted-goods-YLiDhGDR4Ek) | [Olek Buzunov](https://unsplash.com/@olek_bznv_photo) |
| `hub/h-009.jpg` | [person in yellow jacket sits at an outdoor market](https://unsplash.com/photos/person-in-yellow-jacket-sits-at-an-outdoor-market-8DLJXf_Ytsg) | [Charles Puaud](https://unsplash.com/@charlesp25) |
| `hub/h-004.jpg` | [black and silver camera with black tripod](https://unsplash.com/photos/black-and-silver-camera-with-black-tripod-AJRZMx9XV7M) | [Mona Jain](https://unsplash.com/@monajain) |
| `hub/h-006.jpg` | [a cell phone sitting on top of a tripod](https://unsplash.com/photos/a-cell-phone-sitting-on-top-of-a-tripod-oOkcpXAMEOc) | [Yianni Mathioudakis](https://unsplash.com/@yiannifive) |
| `hub/h-014.jpg` | [person using black smartphone with gray and pink case](https://unsplash.com/photos/person-using-black-smartphone-with-gray-and-pink-case-cqFKhqv6Ong) | [Rob Hampson](https://unsplash.com/@robman) |
| `hub/h-005.jpg` | [a group of people standing around each other Tc1mBpMS](https://unsplash.com/photos/a-group-of-people-standing-around-each-other-Tc1mBpMS-zs) | [jimylloyd laumain](https://unsplash.com/@jimylloyd) |
| `hub/h-011.jpg` | [people gathering in room](https://unsplash.com/photos/people-gathering-in-room-5H0p6JPUHbI) | [Product School](https://unsplash.com/@productschool) |
| `hub/h-013.jpg` | [a red cloth with a white tag hanging from it](https://unsplash.com/photos/a-red-cloth-with-a-white-tag-hanging-from-it-J_UuEa_aIeI) | [Anastasiya Doicheva](https://unsplash.com/@an_doich) |
| `hub/h-015.jpg` | [person giving brown box](https://unsplash.com/photos/person-giving-brown-box-BFdSCxmqvYc) | [RoseBox](https://unsplash.com/@rosebox) |
| `hub/h-016.jpg` | [selective focus photography of person using smartphone](https://unsplash.com/photos/selective-focus-photography-of-person-using-smartphone-mw6Onwg4frY) | [freestocks](https://unsplash.com/@freestocks) |
| `hub/h-017.jpg` | [a woman in a blue shirt](https://unsplash.com/photos/a-woman-in-a-blue-shirt-VPvYUK2Iibo) | [Raymond Owusu-Afriyie](https://unsplash.com/@raystudiosgh) |
| `hub/h-018.jpg` | [a man smiles while looking at his cell phone K](https://unsplash.com/photos/a-man-smiles-while-looking-at-his-cell-phone-K-f_gTvdwTM) | [Ali Mkumbwa](https://unsplash.com/@mkumbwajr) |
| `seller/hair-studio.jpg` | [black and white knit textile](https://unsplash.com/photos/black-and-white-knit-textile-ptyj_QoPRsQ) | [Gift Habeshaw](https://unsplash.com/@gift_habeshaw) |
| `seller/maths-tutor.jpg` | [woman in black shirt holding white smartphone](https://unsplash.com/photos/woman-in-black-shirt-holding-white-smartphone-DbLlKd8u2Rw) | [ThisisEngineering](https://unsplash.com/@thisisengineering) |
| `seller/home-bakery.jpg` | [person holding rolling pin](https://unsplash.com/photos/person-holding-rolling-pin--DesRxj28Ns) | [Kari Shea](https://unsplash.com/@karishea) |
| `seller/design-studio.jpg` | [color code book](https://unsplash.com/photos/color-code-book-LPWl2pEVGKc) | [Balázs Kétyi](https://unsplash.com/@balazsketyi) |
| `seller/thrift-rack.jpg` | [a rack of clothes and a pair of shoes](https://unsplash.com/photos/a-rack-of-clothes-and-a-pair-of-shoes-UezE_kVjtc8) | [Anastasiya Badun](https://unsplash.com/@badun) |
| `seller/code-coach.jpg` | [a computer screen with a bunch of code on it](https://unsplash.com/photos/a-computer-screen-with-a-bunch-of-code-on-it-ieic5Tq8YMk) | [Chris Ried](https://unsplash.com/@cdr6934) |
| `seller/phone-fix.jpg` | [iphone components are disassembled on a blue mat](https://unsplash.com/photos/iphone-components-are-disassembled-on-a-blue-mat-8MCqpmAtBs0) | [Fotografia Lui Vlad](https://unsplash.com/@fotografialuivlad) |
| `seller/nail-bar.jpg` | [womans nails with manicure](https://unsplash.com/photos/womans-nails-with-manicure-jRXxNpA6d_k) | [Budka Damdinsuren](https://unsplash.com/@buudkaanaa) |
| `seller/study-notes.jpg` | [person holding on red pen while writing on book](https://unsplash.com/photos/person-holding-on-red-pen-while-writing-on-book-333oj7zFsdg) | [lilartsy](https://unsplash.com/@lilartsy) |
| `seller/res-kitchen.jpg` | [meal prep containers with healthy food](https://unsplash.com/photos/meal-prep-containers-with-healthy-food-lMcRyBx4G50) | [Ella Olsson](https://unsplash.com/@ellaolsson) |
| `seller/tech-corner.jpg` | [white sony headphones and black smartphone case](https://unsplash.com/photos/white-sony-headphones-and-black-smartphone-case-sQ0xXxQdfeY) | [Ady TeenagerInRO](https://unsplash.com/@teenagerinro) |
| `seller/book-swap.jpg` | [assorted title book lot](https://unsplash.com/photos/assorted-title-book-lot-eeSdJfLfx1A) | [Ed Robertson](https://unsplash.com/@eddrobertson) |
| `seller/res-deals.jpg` | [open black compact refrigerator filled with soda bottles](https://unsplash.com/photos/open-black-compact-refrigerator-filled-with-soda-bottles-3h7jbWXhpgM) | [Humphrey M](https://unsplash.com/@good_citizen) |
| `seller/closet-clear-out.jpg` | [assorted color apparels](https://unsplash.com/photos/assorted-color-apparels-oa7pqZmmhuA) | [Sarah Brown](https://unsplash.com/@sweetpagesco) |
| `seller/ticket-desk.jpg` | [person holding brown blue and white tickets](https://unsplash.com/photos/person-holding-brown-blue-and-white-tickets-A_dJOYpxEVU) | [Andy Li](https://unsplash.com/@andylid0) |
| `seller/res-essentials.jpg` | [a black and white photo of a kettle and a cup](https://unsplash.com/photos/a-black-and-white-photo-of-a-kettle-and-a-cup-J4Poo0r0qEk) | [engin akyurt](https://unsplash.com/@enginakyurt) |
| `seller/lash-lounge.jpg` | [tweezers resting on a tray of false eyelashes](https://unsplash.com/photos/tweezers-resting-on-a-tray-of-false-eyelashes-irXGNGSuWW4) | [Jessica Donnelly](https://unsplash.com/@jessicadonnelly) |
| `seller/stationery-stop.jpg` | [pink and purple plastic case NROHA1B](https://unsplash.com/photos/pink-and-purple-plastic-case-NROHA1B-NYk) | [Mitchell Luo](https://unsplash.com/@mitchel3uo) |
| `seller/bookshelf.jpg` | [assorted labeled book lot on white wooden shelf GelF0x5e](https://unsplash.com/photos/assorted-labeled-book-lot-on-white-wooden-shelf-GelF0x5e--c) | [Aneta Pawlik](https://unsplash.com/@anetakpawlik) |
| `seller/moving-out-sale.jpg` | [a large pile of brown cardboard boxes with blue tape](https://unsplash.com/photos/a-large-pile-of-brown-cardboard-boxes-with-blue-tape-qO2ztAz5g7A) | [Rohit Choudhari](https://unsplash.com/@iamrohitchoudhari) |
| `seller/kitchen-kit.jpg` | [flat lay photography of frying pan beside tomatoes on blue surface](https://unsplash.com/photos/flat-lay-photography-of-frying-pan-beside-tomatoes-on-blue-surface-seDjj4dmC9s) | [Icons8 Team](https://unsplash.com/@icons8) |
| `seller/weekend-market.jpg` | [a bicycle with a seat](https://unsplash.com/photos/a-bicycle-with-a-seat-3BRCrIHqsUE) | [yasara hansani](https://unsplash.com/@yashiru) |
| `seller/accounting-tutor.jpg` | [a calculator sitting on top of a pile of papers](https://unsplash.com/photos/a-calculator-sitting-on-top-of-a-pile-of-papers-741iShluYhk) | [FIN](https://unsplash.com/@fin21) |
| `seller/study-desk.jpg` | [white casio calculator r_m](https://unsplash.com/photos/white-casio-calculator-r_m-JKJVto0) | [Annie Spratt](https://unsplash.com/@anniespratt) |
| `seller/room-refresh.jpg` | [a bedroom with a bed dresser and mirror](https://unsplash.com/photos/a-bedroom-with-a-bed-dresser-and-mirror-17YnTgHkSEE) | [Alex Tyson](https://unsplash.com/@alextyson195) |
| `seller/drawing-office.jpg` | [architectural blueprints with drafting tools Yn8D5B8C](https://unsplash.com/photos/architectural-blueprints-with-drafting-tools-Yn8D5B8C-eY) | [Lucas Kepner](https://unsplash.com/@lucaskphoto) |
| `seller/cv-clinic.jpg` | [a woman is reading a resume at a table](https://unsplash.com/photos/a-woman-is-reading-a-resume-at-a-table-9si2noVCVH8) | [Resume Genius](https://unsplash.com/@resumegenius) |
| `seller/logo-lab.jpg` | [handwritten sketches on wooden desk](https://unsplash.com/photos/handwritten-sketches-on-wooden-desk-XbeHYEAgyw0) | [Maria Lupan](https://unsplash.com/@luandmario) |
| `seller/sports-kit.jpg` | [sneakers and a black bag in a grey tray](https://unsplash.com/photos/sneakers-and-a-black-bag-in-a-grey-tray-ocLSuJnQCU0) | [N1CE](https://unsplash.com/@n1ce) |

## Campus photos

The 12 campus photos are Eduvos's own, from the campus pages on [eduvos.com](https://www.eduvos.com/campuses/),
downloaded 2026-10-29 and cropped to a centred square (900 to 1,200px; the smaller ones aren't upscaled). They're in
`public/campus/` and only `data/fixtures/campuses.ts` points at them. Buildings only, no people. **They're Eduvos's
copyright, not stock:** fine for the Eduvos submission, but ask Eduvos marketing to confirm their use (or send their
own) before go-live. Eduvos Online has no building, so it's an Unsplash photo under the licence above.

| File | Source |
|---|---|
| `campus/bedfordview.jpg` | eduvos.com `/campuses/bedfordview-carousel-02.jpg` |
| `campus/bloemfontein.jpg` | eduvos.com `/campuses/bloemfontein-carousel-01.jpg` |
| `campus/cape-town-mowbray.jpg` | eduvos.com `/campuses/mowbraysliertwo.jpg` |
| `campus/cape-town-tyger-valley.jpg` | eduvos.com `/campuses/tygervalley-carousel-01.jpg` |
| `campus/durban-umhlanga.jpg` | eduvos.com `/campuses/durban-carousel-01.jpg` |
| `campus/east-london.jpg` | eduvos.com `/images/el-hero-one.webp` |
| `campus/mbombela.jpg` | eduvos.com `/campuses/mbombela-carousel01.jpg` |
| `campus/midrand.jpg` | eduvos.com `/campuses/midrand-carousel01.jpg` |
| `campus/nelson-mandela-bay.jpg` | eduvos.com `/nmb-campus-page-banner.webp` |
| `campus/potchefstroom.jpg` | eduvos.com `/campuses/potchefstroom-carousel-01.jpg` |
| `campus/pretoria.jpg` | eduvos.com `/campuses/pretoria-carousel-01.jpg` |
| `campus/vanderbijlpark.jpg` | eduvos.com `/campuses/vaal-banner-2025.webp` |
| `campus/online.jpg` | [woman in black jacket using macbook air](https://unsplash.com/photos/woman-in-black-jacket-using-macbook-air-__b279kVy0c) by [Annie Spratt](https://unsplash.com/@anniespratt) (Unsplash) |
