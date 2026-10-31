import { router } from '@kit.ArkUI';
import { askQuestion, type GradedResponse } from '../common/ApiClient';
import { DisplaySocket } from '../common/DisplaySocket';

@Entry
@Component
struct ControlPage {
  @State question: string = '';
  @State response: GradedResponse | null = null;
  @State loading: boolean = false;
  @State selectedDynasty: string = 'tang';
  @State connected: boolean = false;
  private socket: DisplaySocket = new DisplaySocket();

  aboutToAppear(): void {
    this.socket.connect((data: string) => {
      const msg = JSON.parse(data);
      if (msg.type === 'display_status') {
        this.connected = msg.connected;
      }
    }).then(() => {
      this.connected = true;
    }).catch(() => {
      this.connected = false;
    });
  }

  aboutToDisappear(): void {
    this.socket.close();
  }

  build() {
    Column() {
      // 标题栏
      Row() {
        Text('教师遥控端')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#e2dac9')
        Blank()
        Text(this.connected ? '已连接大屏' : '未连接')
          .fontSize(14)
          .fontColor(this.connected ? '#4caf50' : '#f44336')
      }
      .width('100%')
      .padding(16)
      .backgroundColor('#1b1f24')

      // 朝代选择
      Row() {
        Button('唐')
          .fontSize(16)
          .backgroundColor(this.selectedDynasty === 'tang' ? '#c0492c' : '#2e353d')
          .fontColor('#e2dac9')
          .onClick(() => {
            this.selectedDynasty = 'tang';
            this.sendCommand({ type: 'select_dynasty', dynasty: 'tang' });
          })
        Button('明')
          .fontSize(16)
          .backgroundColor(this.selectedDynasty === 'ming' ? '#c0492c' : '#2e353d')
          .fontColor('#e2dac9')
          .onClick(() => {
            this.selectedDynasty = 'ming';
            this.sendCommand({ type: 'select_dynasty', dynasty: 'ming' });
          })
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
      .gap(12)
      .padding(16)

      // 问答输入
      Row() {
        TextInput({ placeholder: '问一个问题...' })
          .fontSize(16)
          .fontColor('#e2dac9')
          .backgroundColor('#2e353d')
          .width('70%')
          .onChange((value: string) => {
            this.question = value;
          })
        Button('提问')
          .fontSize(16)
          .backgroundColor('#c0492c')
          .fontColor('#e2dac9')
          .enabled(!this.loading)
          .onClick(() => {
            this.handleAsk();
          })
      }
      .width('100%')
      .padding(16)
      .gap(8)

      // 回答展示
      if (this.response) {
        Scroll() {
          Column() {
            // 档位标签
            Row() {
              Text(this.levelLabel(this.response.level))
                .fontSize(14)
                .fontColor('#ffffff')
                .backgroundColor(this.levelColor(this.response.level))
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .borderRadius(4)
            }
            .margin({ bottom: 8 })

            // 答案
            Text(this.response.answer)
              .fontSize(16)
              .fontColor('#e2dac9')
              .lineHeight(24)
              .margin({ bottom: 12 })

            // 出处
            if (this.response.evidence.length > 0) {
              Text('出处')
                .fontSize(14)
                .fontColor('#a99f8c')
                .margin({ bottom: 4 })
              ForEach(this.response.evidence, (ev: GradedResponse['evidence'][0]) => {
                Column() {
                  Text(ev.source)
                    .fontSize(14)
                    .fontColor('#4fc3f7')
                    .fontWeight(FontWeight.Bold)
                  Text('"' + ev.quote + '"')
                    .fontSize(13)
                    .fontColor('#a99f8c')
                    .margin({ top: 2 })
                }
                .backgroundColor('#2e353d')
                .padding(12)
                .borderRadius(8)
                .margin({ bottom: 8 })
                .width('100%')
              })
            }

            // 地图联动按钮
            if (this.response.mapAction) {
              Button('在地图上查看')
                .fontSize(16)
                .backgroundColor('#0f3460')
                .fontColor('#e2dac9')
                .width('100%')
                .onClick(() => {
                  this.sendCommand({
                    type: 'map_action',
                    mapAction: this.response!.mapAction
                  });
                })
            }
          }
          .padding(16)
        }
        .width('100%')
        .layoutWeight(1)
      }

      // 切换到大屏模式
      Button('切换到大屏显示')
        .fontSize(16)
        .backgroundColor('#2e353d')
        .fontColor('#e2dac9')
        .width('90%')
        .margin({ bottom: 16 })
        .onClick(() => {
          router.pushUrl({ url: 'pages/DisplayPage' });
        })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#14171b')
  }

  private async handleAsk(): Promise<void> {
    if (!this.question.trim()) return;
    this.loading = true;
    this.response = null;
    try {
      this.response = await askQuestion(this.question);
      this.sendCommand({
        type: 'qa_response',
        response: this.response
      });
    } catch (e) {
      console.error('Ask error:', JSON.stringify(e));
    } finally {
      this.loading = false;
    }
  }

  private sendCommand(cmd: object): void {
    this.socket.send(JSON.stringify(cmd));
  }

  private levelLabel(level: number): string {
    const labels: Record<number, string> = { 1: '直答', 2: '条件答', 3: '范围声明', 4: '证据展示' };
    return labels[level] || '未知';
  }

  private levelColor(level: number): string {
    const colors: Record<number, string> = { 1: '#4caf50', 2: '#ff9800', 3: '#2196f3', 4: '#9c27b0' };
    return colors[level] || '#888888';
  }
}