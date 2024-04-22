import axios from 'axios';
import XLSX from 'xlsx';
import { join } from 'path';
import pkg from 'lodash';
import dayjs from 'dayjs';
import { createLogUpdate } from 'log-update';
import { config } from 'dotenv';

const { uniqWith, isEqual } = pkg;
const { readFile, utils } = XLSX;
config();
// Configuration des informations de connexion
const ODK_CENTRAL_URL = process.env.ODK_CENTRAL_URL;
const DHIS2_SERVER_URL = process.env.DHIS2_SERVER_URL;
const ODK_USERNAME = process.env.ODK_USERNAME;
const ODK_PASSWORD = process.env.ODK_PASSWORD;
const ODK_PROJECT = process.env.ODK_PROJECT;
const DHIS2_USERNAME = process.env.DHIS2_USERNAME;
const DHIS2_PASSWORD = process.env.DHIS2_PASSWORD;
const mois = [
  { id: '01', name: 'janvier' },
  { id: '02', name: 'février' },
  { id: '03', name: 'mars' },
  { id: '04', name: 'avril' },
  { id: '05', name: 'mai' },
  { id: '06', name: 'juin' },
  { id: '07', name: 'juillet' },
  { id: '08', name: 'août' },
  { id: '09', name: 'septembre' },
  { id: '10', name: 'octobre' },
  { id: '11', name: 'novembre' },
  { id: '12', name: 'décembre' },
];
const frames = ['-', '\\', '|', '/'];
let index = 0;

const readFileXlsxAndFormatDHIS2 = async (_tab) => {
  try {
    const pathLink = join('template.xlsx');
    const wb = readFile(pathLink);
    const wsname = wb.SheetNames[0];
    const wsname2 = wb.SheetNames[1];
    const wsname3 = wb.SheetNames[2];
    const wsname4 = wb.SheetNames[3];
    const ws = wb.Sheets[wsname];
    const ws2 = wb.Sheets[wsname2];
    const ws3 = wb.Sheets[wsname3];
    const ws4 = wb.Sheets[wsname4];
    const _tab1 = utils.sheet_to_json(ws);
    const _tab2 = utils.sheet_to_json(ws2);
    const _tab3 = utils.sheet_to_json(ws3);
    const dataElement = utils.sheet_to_json(ws4);
    const results = [];

    dataElement.forEach((key) => {
      for (let i = 0; i < _tab.length; i++) {
        const element = _tab[i];
        const month = mois.find((m) => m.name === element['ig_mois']);
        const pyramide = _tab3.find(
          (item) =>
            item.zone_de_sante === element['ig_health_zone'] &&
            item.aire_de_sante === element['ig_health_area'] &&
            item.fosa === element['ig_structure']
        );
        const keyData =
          Object.keys(element).filter((name) => name === key.data_element_odk)
            .length > 0
            ? key
            : '';
        const UID = typeof keyData === 'object' ? key.UID : null;
        const value =
          typeof keyData === 'object'
            ? element[keyData.data_element_odk]
            : null;
        if (month && pyramide && value && UID) {
          results.push({
            dataelement: UID,
            period: `${element['ig_annee']}${
              month !== undefined ? month.id : ''
            }`,
            OrgUnit: pyramide['OrgUnit'],
            categoryoptioncombo: 'c6PwdArn3fZ',
            attributeoptioncombo: 'c6PwdArn3fZ',
            value: value === 'non' ? 0 : value === 'oui' ? 1 : value,
            storedBy: 'imported',
            lastupdated: dayjs(element['submissionDate']).format('YYYY-MM-DD'),
            comment: '',
            followup: false,
            deleted: null,
          });
        }
      }
    });

    return uniqWith(results.flat(), isEqual);
  } catch (error) {
    throw error;
  }
};

// Fonction pour télécharger un fichier depuis ODK Central
async function downloadFileFromODKCentral(formId, submissionId) {
  try {
    const response = await axios.get(
      `${ODK_CENTRAL_URL}v1/projects/${ODK_PROJECT}/forms/${formId}/Submissions`,
      {
        auth: {
          username: ODK_USERNAME,
          password: ODK_PASSWORD,
        },
      }
    );
    return response.data.value;
  } catch (error) {
    console.error(
      'Erreur lors du téléchargement du fichier depuis ODK Central:',
      error.message
    );
    throw error;
  }
}

// Fonction pour importer les données sur le serveur DHIS2
async function importDataToDHIS2(processedData) {
  try {
    const form = {
      dataValues: processedData,
    };

    const response = await axios.post(
      `${DHIS2_SERVER_URL}/api/dataValueSets?async=true&skipAudit=true`,
      form,
      {
        auth: {
          username: DHIS2_USERNAME,
          password: DHIS2_PASSWORD,
        },
      }
    );

    console.log('Importation des données réussie:', response.data);
  } catch (error) {
    console.error(
      "Erreur lors de l'importation des données sur DHIS2:",
      error.message
    );
    throw error;
  }
}

const formatData = (data) => {
  const newData = [];
  data.forEach((item) => {
    const obj = {
      ...item['beneficiaire']['nouveau_cas_svs'],
      ...item['beneficiaire']['nouveau_cas_svs_dans_72'],
      ...item['beneficiaire']['svs_ayant_recu_kitpep_adulte_dans_les_72'],
      ...item['beneficiaire']['svs_ayant_recu_kitpep_pediatric_dans_les_72'],
      ...item['beneficiaire'][
        'nb_deplacees_internes_ayant_recu_kitpep_dans_72'
      ],
      ...item['stock']['kdm'],
      ...item['stock']['krpm'],
      ...item['stock']['kcm'],
      ...item['stock']['kpa'],
      ...item['stock']['kfm'],
      ...item['rupture_stock'],
      ...item['npf']['npf_prestataire_forme_par_ima_en_VBG'],
      ...item['npf']['npf_prestataire_forme_par_ima_sp'],
      ...item['npf']['npf_prestataire_forme_par_autre_en_VBG'],
      ...item['npf']['npf_prestataire_forme_par_autre_en_ca'],
    };
    // const nameObj = Object.keys(obj).reduce((a, b) => ({ ...a, name: b }), {});
    newData.push({
      ig_health_zone: item.ig['health_zone'],
      ig_health_area: item.ig['health_area'],
      ig_structure: item.ig['structure'],
      ig_mois: item.ig['mois'],
      ig_annee: item.ig['annee'],
      ig_structure: item.ig['structure'],
      ...obj,
      ...item['__system'],
    });
  });

  return newData.flat();
};

// Fonction principale
async function main() {
  const formId = 'bha_pepkits_monthly_collect_fosa.svc'; // Remplacez par l'ID de votre formulaire ODK
  const submissionId = 'uuid:3Ad395ac32-5710-42b7-87b1-37213f92f53c'; // Remplacez par l'ID de votre soumission ODK
  const log = createLogUpdate(process.stdin);

  setInterval(() => {
    const frame = frames[(index = ++index % frames.length)];
    log(`${frame} please wait`);
  }, 80);

  try {
    // Télécharger le fichier depuis ODK Central
    const result = await downloadFileFromODKCentral(formId, submissionId);
    let start = 0;
    let end = 500;
    const indexs = result.length / end;
    const index = parseInt(indexs, 10);
    for (let i = 0; i < index; i++) {
      start = i * end;
      end = start + end;
      const data = result.slice(start, end);
      const format = formatData(data);
      const processedData = await readFileXlsxAndFormatDHIS2(format);
      await importDataToDHIS2(processedData);
      log(`Send successfully`);
    }
    // console.log(processedData.length);
    log.clear();
    log.done();
    process.exit(1);
  } catch (error) {
    log.clear();
    console.error('Une erreur est survenue:', error.message);
    process.exit(1);
  }
}

// Appeler la fonction principale
main();
