/** mermaid
 *  Timeline 时间线 jison 文法（移植官方 mermaid v11）
 *
 *  来源: mermaid-develop/packages/mermaid/src/diagrams/timeline/parser/timeline.jison
 *
 *  修改说明（M10 移植版）:
 *    - yy.getCommonDb().setDiagramTitle/setAccTitle/setAccDescription → yy.setDiagramTitle/setAccTitle/setAccDescription
 *      （4 处，对齐 M8 gantt.jison 模式，TimelineDB 类直接定义这些方法）
 *    - yy.setDirection('TD') → yy.setDirection('TB')
 *      （1 处，TD→TB 映射，对齐 types.ts 的 'LR' | 'TB' 类型）
 *    - 文法规则保持与官方一致，确保解析能力完整（section/period/event/续行事件/多事件）
 *    - 新增 accDescription 全词 token（对齐 gantt.jison，支持 "accDescription value" 不带冒号格式）
 *    - 调用的 yy 方法由 TimelineDB 移植版提供（packages/serializer/src/parser/timeline-db.ts）
 *
 *  MIT license.
 */
%lex
%options case-insensitive
%x acc_title
%x acc_descr
%x acc_descr_multiline

%%

\%%(?!\{)[^\n]*                                                 /* skip comments */
[^\}]\%\%[^\n]*                                                 /* skip comments */
[\n]+                   return 'NEWLINE';
\s+                     /* skip whitespace */
\#[^\n]*                /* skip comments */

"timeline"[ \t]+LR       return 'timeline_lr';
"timeline"[ \t]+TD       return 'timeline_td';
"timeline"               return 'timeline';
"title"\s[^\n]+       return 'title';
accTitle\s*":"\s*                                               { this.begin("acc_title");return 'acc_title'; }
<acc_title>(?!\n|;|#)*[^\n]*                                    { this.popState(); return "acc_title_value"; }
accDescr\s*":"\s*                                               { this.begin("acc_descr");return 'acc_descr'; }
<acc_descr>(?!\n|;|#)*[^\n]*                                    { this.popState(); return "acc_descr_value"; }
accDescr\s*"{"\s*                                { this.begin("acc_descr_multiline");}
<acc_descr_multiline>[\}]                       { this.popState(); }
<acc_descr_multiline>[^\}]*                     return "acc_descr_multiline_value";
"section"\s[^:\n]+    return 'section';
"accDescription"\s[^#\n;]+      return 'accDescription';

// event starting with ":" keyword (continuation event or multi-event line)
":"\s(?:[^:\n]|":"(?!\s))+        return 'event';
[^#:\n]+               return 'period';


<<EOF>>                 return 'EOF';
.                       return 'INVALID';

/lex

%left '^'

%start start

%% /* language grammar */

start
	: timeline_header document 'EOF' { return $2; }
	;

timeline_header
	: timeline
	| timeline_lr { yy.setDirection('LR'); }
	| timeline_td { yy.setDirection('TB'); }
	;

document
	: /* empty */ { $$ = [] }
	| document line {$1.push($2);$$ = $1}
	;

line
	: SPACE statement { $$ = $2 }
	| statement { $$ = $1 }
	| NEWLINE { $$=[];}
	| EOF { $$=[];}
	;

statement
  : title {yy.setDiagramTitle($1.substr(6));$$=$1.substr(6);}
  | acc_title acc_title_value  { $$=$2.trim();yy.setAccTitle($$); }
  | acc_descr acc_descr_value  { $$=$2.trim();yy.setAccDescription($$); }
  | acc_descr_multiline_value { $$=$1.trim();yy.setAccDescription($$); }
  | accDescription { yy.setAccDescription($1.substr(15).trim()); $$=$1.substr(15).trim(); }
  | section {yy.addSection($1.substr(8));$$=$1.substr(8);}
  | period_statement
  | event_statement
  ;
period_statement
  : period {yy.addTask($1,0,'');$$=$1;}
;
event_statement
  : event {yy.addEvent($1.substr(2));$$=$1;}
;

%%
