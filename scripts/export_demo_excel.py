"""Fill the unchanged v1 workbook structure with the Mughsayl web demo data."""
from pathlib import Path
from datetime import datetime
import re
import json
import shutil
from openpyxl import load_workbook
from openpyxl.comments import Comment

ROOT = Path(__file__).resolve().parents[1]
wb = load_workbook(ROOT / 'deliverables/VIA_Project_Report_Template_v1.xlsx')
source = (ROOT / 'scripts/generate-dashboard-demo.ts').read_text(encoding='utf-8')
provenance = 'Mughsayl HTML demo — DUMMY DATA, not an approved report'

def source_array(name):
    return json.loads(re.search(r'const '+name+r' = (\[[\s\S]*?\]);', source).group(1).replace(',\n]', '\n]'))

values = {
 'project_name':'Construction Works of Mughsayl Road and Bridge',
 'project_reference':'DEMO ONLY / 2026 / 01',
 'project_type':'Illustrative data — not an approved report',
 'region':'Governorate of Dhofar, Sultanate of Oman',
 'report_month':datetime(2026,7,1), 'report_number':'17',
 'data_as_of':datetime(2026,7,31), 'revision':'Rev-01',
 'source_filename':'http://localhost:8080/demos/mughsayl.html',
 'brief':'Bridge and approach road works',
 'currency':'R.O.', 'dashboard_contract_value':34844451.558,
 'contract_basis':'Demo dashboard contract value; original/variation breakdown not supplied',
 'award_date':datetime(2025,1,1), 'start_date':datetime(2025,3,2),
 'completion_date':datetime(2027,8,30), 'expected_completion':datetime(2027,8,30),
 'mobilization_days':60, 'construction_days':912, 'elapsed_days':517, 'remaining_days':395,
 'physical_planned':47.95, 'physical_actual':40.94, 'physical_variance_reported':-7.01,
 'monthly_planned':3.72, 'monthly_actual':1.69, 'financial_actual':33.38,
 'paid_amount':10969331.064, 'chart_mode':'Verified schedule',
}
for name in ['Project','Contract_Dates','Progress_Finance']:
    ws=wb[name]
    for r in range(4,ws.max_row+1):
        key=ws.cell(r,1).value
        if key in values:
            ws.cell(r,3,values[key]); ws.cell(r,6,'Needs review'); ws.cell(r,7,provenance)
    if name=='Progress_Finance':
        for row in ws:
            if row[0].value=='chart_mode':
                row[2].comment=Comment('Numerical schedule for demo rendering only. NOT verified project data.', 'Preview export')

names=source_array('names'); plans=source_array('plans'); actuals=source_array('actuals')
for r,(name,p,a) in enumerate(zip(names,plans,actuals),4):
    ws=wb['Activities']
    for c,v in {2:name,3:p,4:a,5:round(a-p,2),7:'Needs review',8:provenance,9:'Dummy activity figures from the demo; not for reporting.'}.items():ws.cell(r,c,v)
    if a>100:ws.cell(r,4).comment=Comment('103.40 is present in the demo and intentionally preserved, not capped at 100.', 'Preview export')

monthly=source_array('monthly'); achieved=source_array('achieved')
pc=ac=0
for i,p in enumerate(monthly):
    r=i+4; ws=wb['Monthly_Schedule']; pc=round(pc+p,2)
    a=achieved[i] if i<len(achieved) else None
    if a is not None:ac=round(ac+a,2)
    year=2025+(1+i)//12; month=(1+i)%12+1
    for c,v in {1:datetime(year,month,1),2:p,3:a,4:pc,5:ac if a is not None else None,7:'Needs review',8:provenance,9:'Dummy programme; future actuals intentionally blank.'}.items():
        if v is not None:ws.cell(r,c,v)

for r,p,a in [(4,126,110),(5,310,290)]:
    ws=wb['Resources']
    for c,v in {2:p,3:a,5:a-p,7:'Needs review',8:provenance}.items():ws.cell(r,c,v)

scope=[('Asphalt road length',28.090,'km'),('Salalah By-pass',5.521,'km'),('Under-passes',8,'no.'),('Flyover',1,'no.'),('Box culverts',82,'no.')]
layers=[('BWC','Bituminous Wearing Course',50),('BBC','Bituminous Base Course',60),('ABC','Aggregate Base Course',300),('GSB','Granular Sub-Base',200)]
ws=wb['Scope_Layers']
for r,(name,q,u) in enumerate(scope,4):
    for c,v in {1:'Scope',2:f'scope_{r-3:02}',3:name,4:q,5:u,8:'Needs review',9:provenance}.items():ws.cell(r,c,v)
    ws.cell(r,4).number_format='0.000' if u=='km' else '0'
for r,(code,name,t) in enumerate(layers,9):
    for c,v in {1:'Layer',2:code,3:name,6:t,8:'Needs review',9:provenance}.items():ws.cell(r,c,v)

trades=['Protection — cut slope','Utilities','Land acquisition','Culverts / retaining walls','Bridges / tunnels','Pedestrian over/underpass','Earthworks','Subbase layer','Aggregate base course','Bit. base course','Bit. wearing course','Protection — embankment']
statuses=['Active','Active','Complete','Complete','Active','Active','Complete','Behind','Behind','Behind','Not started','Active']
for r,(name,status) in enumerate(zip(trades,statuses),4):
    for c,v in {2:name,3:status,4:'Needs review',5:provenance,6:'Dummy trade status'}.items():wb['Status_Updates'].cell(r,c,v)

parties=[['Example Transport Authority','Roads & Land Transport',None,None,None],['VIA International — Engineering Consultancy',None,'Demo Resident Engineer','Resident Engineer','Demo contact'],['Example Road & Bridge Contractor',None,'Demo Project Manager','Project Manager','Demo contact'],[None,None,'Demo Client Representative',None,'Demo contact']]
for r,party in enumerate(parties,4):
    for c,v in enumerate(party,2):
        if v is not None:wb['Contacts'].cell(r,c,v)
    wb['Contacts'].cell(r,8,'Needs review');wb['Contacts'].cell(r,9,provenance)

captions=source_array('captions')
for r in range(4,wb['Assets'].max_row+1):
    ws=wb['Assets']; key=ws.cell(r,1).value
    if key=='logo_main':ws.cell(r,4,'Dashboard/via/logo-color.png');ws.cell(r,8,'Needs review')
    elif key=='layout_main':
        ws.cell(r,4,'Dashboard/Raysut dashboard.html');ws.cell(r,5,'Raysut reference illustration — demo only')
        ws.cell(r,9,'Embedded vector schematic, not an uploaded image. Requires the Raysut reference-layout option; not transferable to another route.');ws.cell(r,8,'Needs review')
    elif key and key.startswith('photo_'):
        i=int(key[-1]);ws.cell(r,4,f'Dashboard/Photo{i}.jpg');ws.cell(r,5,captions[i-1]);ws.cell(r,6,'Reference photograph — demonstration only');ws.cell(r,8,'Needs review')
    elif key=='s_curve':ws.cell(r,9,'Interactive chart is populated from Monthly_Schedule, not a picture.')

wb['Read_Me']['B5']='Filled from the Mughsayl web demo. ALL entered values are DUMMY DATA, not approved project figures.'
wb['Read_Me'].append(['Demo footer code','DUMMY DATA — NOT FOR REPORTING (current template has no dedicated footer-code field).'])
wb['Read_Me'].append(['Unused entries','Fields not supplied by the demo remain blank, including original contract breakdown and financial planned %.'])
wb['Read_Me'].append(['Project URL','The demo is /demos/mughsayl.html; no live project slug is assigned to this workbook.'])
wb['Checks']['B12']='NOT APPROVED — DUMMY DATA'
out=ROOT/'deliverables/VIA_Mughsayl_Demo_Current_Template.xlsx'
wb.save(out)
check=load_workbook(out)
assert len(check.sheetnames)==12
assert check['Monthly_Schedule']['D21'].value==47.95
assert check['Monthly_Schedule']['E21'].value==40.94
assert check['Monthly_Schedule']['D34'].value==100
assert check['Monthly_Schedule']['E22'].value is None
assert check['Activities']['F4'].data_type=='f'
assert check['Activities']['D6'].value==103.4
assert check['Resources']['B4'].value==126
download=ROOT/'public/demos'/out.name
download.parent.mkdir(exist_ok=True,parents=True)
shutil.copy2(out,download)
print(f'{out.name}: 12 original sheets; 31 schedule months; 10 activities; 12 trades; 5 scope items; 4 layers. Checks passed.')
