import { router } from '@kit.ArkUI';
import { DisplaySocket } from '../common/DisplaySocket';

@Entry
@Component
struct DisplayPage {
  @State mapUrl: string = 'http://192.168.1.100:5173/舆图山河录.html';
  @State displayContent: string = '';
  @State currentDynasty: string = 'tang';
  @State showOverlay: boolean = false;
  @State overlayTitle: string = '';
  @State overlayAnswer: string = '';
  @State overlayEvidence: string[] = [];
  private socket: DisplaySocket = new DisplaySocket();

  aboutToAppear(): void {
    this.socket.connect((data: string) => {
      const msg = JSON.parse(data);
      this.handleMessage(msg);
    });
  }

  aboutToDisappear(): void {
    this.socket.close();
  }

  private handleMessage(msg: Record<string, Object>): void {
    const type = msg['type'] as string;
    if (type === 'select_dynasty') {
      this.currentDynasty = msg['dynasty'] as string;
    } else if (type === 'map_action') {
      const action = msg['mapAction'] as Record<string, Object>;
      this.showOverlay = true;
      this.overlayTitle = '地图联动';
      this.overlayAnswer = `${action['dynasty']} · ${action['layer']} · ${action['year'] || ''}`;
    } else if (type === 'qa_response') {
      const resp = msg['response'] as Record<string, Object>;
      this.showOverlay = true;
      this.overlayTitle = this.levelLabel(resp['level'] as number);
      this.overlayAnswer = resp['answer'] as string;
      const evidence = resp['evidence'] as Record<string, string>[];
      this.overlayEvidence = evidence.map(ev => `${ev.source}: "${ev.quote}"`);
    }
  }

  build() {
    Stack() {
      // WebView 显示地图
      Web({ src: this.mapUrl })
        .width('100%')
        .height('100%')
        .domStorageAccess(true)
        .onlineAccess(true)

      // 浮层显示问答结果
      if (this.showOverlay) {
        Column() {
          // 标题
          Row() {
            Text(this.overlayTitle)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor('#e2dac9')
            Blank()
            Button('关闭')
              .fontSize(14)
              .backgroundColor('#2e353d')
              .fontColor('#e2dac9')
              .onClick(() => {
                this.showOverlay = false;
              })
          }
          .width('100%')
          .padding(12)

          // 答案
          Text(this.overlayAnswer)
            .fontSize(16)
            .fontColor('#e2dac9')
            .lineHeight(24)
            .padding(12)
            .width('100%')

          // 出处
          if (this.overlayEvidence.length > 0) {
            Column() {
              ForEach(this.overlayEvidence, (ev: string) => {
                Text(ev)
                  .fontSize(13)
                  .fontColor('#a99f8c')
                  .padding({ left: 12, right: 12, top: 4, bottom: 4 })
                  .width('100%')
              })
            }
            .width('100%')
            .padding({ left: 12, right: 12, bottom: 12 })
          }
        }
        .width('400')
        .backgroundColor('#1b1f24')
        .borderRadius(12)
        .position({ x: '70%', y: 20 })
        .shadow({ radius: 20, color: '#000000', offsetX: 0, offsetY: 4 })
      }

      // 朝代指示器
      Row() {
        Text(this.currentDynasty === 'tang' ? '唐' : '明')
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor('#c0492c')
      }
      .position({ x: 20, y: 20 })
      .backgroundColor('#1b1f24')
      .padding({ left: 16, right: 16, top: 8, bottom: 8 })
      .borderRadius(8)

      // 切换回遥控端
      Button('切换到遥控端')
        .fontSize(14)
        .backgroundColor('#2e353d')
        .fontColor('#e2dac9')
        .position({ x: 20, y: 80 })
        .onClick(() => {
          router.back();
        })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#14171b')
  }

  private levelLabel(level: number): string {
    const labels: Record<number, string> = { 1: '直答', 2: '条件答', 3: '范围声明', 4: '证据展示' };
    return labels[level] || '未知';
  }
}