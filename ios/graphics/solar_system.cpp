// solar_system.cpp
// macOS 太阳系模拟程序（完整修复版）
// 编译: g++ -o solar_system solar_system.cpp -framework OpenGL -framework GLUT
// 运行: ./solar_system

#include <GLUT/glut.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// 行星数据结构
struct Planet {
    char name[20];       // 名称
    float distance;      // 公转半径
    float radius;        // 半径（相对大小）
    float speed;         // 公转速度
    float rotationSpeed; // 自转速度
    float r, g, b;       // 颜色
    float angle;         // 当前角度
};

// 行星数据（相对比例经过调整以便显示）
Planet planets[] = {
    {"水星", 2.5f, 0.2f,  0.04f, 0.1f, 0.8f, 0.7f, 0.6f, 0.0f},
    {"金星", 3.5f, 0.25f, 0.025f, 0.08f, 0.9f, 0.7f, 0.4f, 0.0f},
    {"地球", 4.5f, 0.28f, 0.02f, 0.1f,  0.2f, 0.5f, 0.9f, 0.0f},
    {"火星", 5.5f, 0.23f, 0.015f, 0.09f, 0.9f, 0.4f, 0.3f, 0.0f},
    {"木星", 7.5f, 0.45f, 0.008f, 0.15f, 0.8f, 0.6f, 0.4f, 0.0f},
    {"土星", 9.0f, 0.4f,  0.006f, 0.12f, 0.9f, 0.8f, 0.5f, 0.0f},
    {"天王星",10.5f,0.35f, 0.004f, 0.11f, 0.6f, 0.8f, 0.9f, 0.0f},
    {"海王星",12.0f,0.35f, 0.003f, 0.11f, 0.3f, 0.4f, 0.8f, 0.0f}
};

const int planetCount = sizeof(planets) / sizeof(Planet);

// 相机控制变量
float cameraAngleX = 25.0f;     // 相机水平角度
float cameraAngleY = -30.0f;    // 相机垂直角度
float cameraDistance = 25.0f;    // 相机距离
int lastMouseX, lastMouseY;
bool mousePressed = false;

// 动画控制
bool animationEnabled = true;
float timeScale = 1.0f;          // 时间缩放因子

// 视角控制
bool orthoMode = false;           // 是否正交投影
float fieldOfView = 60.0f;        // 视野角度

// 显示选项
bool showOrbits = true;           // 显示轨道
bool showLabels = true;           // 显示标签
bool showStars = true;            // 显示星空

// 星空粒子
struct Star {
    float x, y, z;
    float brightness;
};

Star stars[1000];

// 自转角度
float rotationAngles[8] = {0};

// 初始化星空
void initStars() {
    for (int i = 0; i < 1000; i++) {
        stars[i].x = (float)(rand() % 2000 - 1000) / 10.0f;
        stars[i].y = (float)(rand() % 2000 - 1000) / 10.0f;
        stars[i].z = (float)(rand() % 2000 - 1000) / 10.0f - 50.0f;
        stars[i].brightness = 0.3f + (float)(rand() % 70) / 100.0f;
    }
}

// 绘制星球（带纹理效果）
void drawSphere(float radius, float r, float g, float b, bool isSun = false) {
    GLfloat mat_ambient[] = { r * 0.4f, g * 0.4f, b * 0.4f, 1.0f };
    GLfloat mat_diffuse[] = { r, g, b, 1.0f };
    GLfloat mat_specular[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    GLfloat mat_emission[] = { 0.0f, 0.0f, 0.0f, 1.0f };
    GLfloat mat_shininess[] = { isSun ? 100.0f : 50.0f };
    
    if (isSun) {
        // 太阳自发光
        mat_emission[0] = r * 0.3f;
        mat_emission[1] = g * 0.3f;
        mat_emission[2] = b * 0.3f;
    }
    
    glMaterialfv(GL_FRONT, GL_AMBIENT, mat_ambient);
    glMaterialfv(GL_FRONT, GL_DIFFUSE, mat_diffuse);
    glMaterialfv(GL_FRONT, GL_SPECULAR, mat_specular);
    glMaterialfv(GL_FRONT, GL_EMISSION, mat_emission);
    glMaterialfv(GL_FRONT, GL_SHININESS, mat_shininess);
    
    GLUquadric* quad = gluNewQuadric();
    gluQuadricDrawStyle(quad, GLU_FILL);
    gluQuadricNormals(quad, GLU_SMOOTH);
    gluSphere(quad, radius, 50, 50);
    gluDeleteQuadric(quad);
}

// 绘制轨道
void drawOrbit(float radius, float r, float g, float b) {
    glDisable(GL_LIGHTING);
    glColor3f(r, g, b);
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < 360; i++) {
        float angle = i * M_PI / 180.0f;
        float x = radius * cos(angle);
        float z = radius * sin(angle);
        glVertex3f(x, 0.0f, z);
    }
    glEnd();
    glEnable(GL_LIGHTING);
}

// 绘制土星环
void drawSaturnRing(float radius) {
    glDisable(GL_LIGHTING);
    glColor3f(0.7f, 0.6f, 0.4f);
    glBegin(GL_QUAD_STRIP);
    for (int i = 0; i <= 360; i++) {
        float angle = i * M_PI / 180.0f;
        float x1 = (radius + 0.15f) * cos(angle);
        float z1 = (radius + 0.15f) * sin(angle);
        float x2 = (radius + 0.35f) * cos(angle);
        float z2 = (radius + 0.35f) * sin(angle);
        
        glVertex3f(x1, 0.05f, z1);
        glVertex3f(x2, 0.05f, z2);
        glVertex3f(x2, -0.05f, z2);
        glVertex3f(x1, -0.05f, z1);
    }
    glEnd();
    glEnable(GL_LIGHTING);
}

// 绘制文字标签
void drawLabel(const char* text, float x, float y, float z, float r, float g, float b) {
    glDisable(GL_LIGHTING);
    glColor3f(r, g, b);
    glRasterPos3f(x, y + 0.3f, z);
    for (const char* c = text; *c != '\0'; c++) {
        glutBitmapCharacter(GLUT_BITMAP_HELVETICA_12, *c);
    }
    glEnable(GL_LIGHTING);
}

// 绘制星空
void drawStars() {
    if (!showStars) return;
    
    glDisable(GL_LIGHTING);
    glPointSize(1.5f);
    glBegin(GL_POINTS);
    for (int i = 0; i < 1000; i++) {
        glColor3f(stars[i].brightness, stars[i].brightness, stars[i].brightness);
        glVertex3f(stars[i].x, stars[i].y, stars[i].z);
    }
    glEnd();
    glPointSize(1.0f);
    glEnable(GL_LIGHTING);
}

// 更新行星位置
void updatePlanets() {
    static int lastTime = 0;
    int currentTime = glutGet(GLUT_ELAPSED_TIME);
    float deltaTime = (currentTime - lastTime) / 1000.0f;
    lastTime = currentTime;
    
    if (!animationEnabled || deltaTime > 0.1f) return;
    
    // 限制最大帧间隔
    if (deltaTime > 0.05f) deltaTime = 0.05f;
    
    float speedFactor = deltaTime * timeScale;
    
    for (int i = 0; i < planetCount; i++) {
        planets[i].angle += planets[i].speed * speedFactor;
        if (planets[i].angle > 2 * M_PI) {
            planets[i].angle -= 2 * M_PI;
        }
        // 更新自转角度
        rotationAngles[i] += planets[i].rotationSpeed * speedFactor * 50.0f;
        if (rotationAngles[i] > 360.0f) {
            rotationAngles[i] -= 360.0f;
        }
    }
}

// 绘制场景
void display() {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glLoadIdentity();
    
    // 设置相机位置
    float eyeX = cameraDistance * cos(cameraAngleY * M_PI / 180.0f) * cos(cameraAngleX * M_PI / 180.0f);
    float eyeY = cameraDistance * sin(cameraAngleY * M_PI / 180.0f);
    float eyeZ = cameraDistance * cos(cameraAngleY * M_PI / 180.0f) * sin(cameraAngleX * M_PI / 180.0f);
    
    gluLookAt(eyeX, eyeY, eyeZ,  // 相机位置
              0.0f, 0.0f, 0.0f,  // 看向原点
              0.0f, 1.0f, 0.0f); // 上方向
    
    // 设置光源位置
    GLfloat lightPos[] = { 0.0f, 0.0f, 0.0f, 1.0f };
    glLightfv(GL_LIGHT0, GL_POSITION, lightPos);
    
    // 绘制星空
    drawStars();
    
    // 绘制轨道
    if (showOrbits) {
        for (int i = 0; i < planetCount; i++) {
            drawOrbit(planets[i].distance, 0.5f, 0.5f, 0.5f);
        }
    }
    
    // 绘制太阳
    drawSphere(1.2f, 1.0f, 0.6f, 0.0f, true);
    if (showLabels) {
        drawLabel("太阳", 0.0f, 1.5f, 0.0f, 1.0f, 0.8f, 0.0f);
    }
    
    // 添加太阳光晕效果
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glDisable(GL_LIGHTING);
    glColor4f(1.0f, 0.8f, 0.0f, 0.1f);
    drawSphere(1.4f, 1.0f, 0.8f, 0.0f);
    glEnable(GL_LIGHTING);
    glDisable(GL_BLEND);
    
    // 绘制行星
    for (int i = 0; i < planetCount; i++) {
        Planet& p = planets[i];
        float x = p.distance * cos(p.angle);
        float z = p.distance * sin(p.angle);
        
        glPushMatrix();
        glTranslatef(x, 0.0f, z);
        
        // 自转
        glRotatef(rotationAngles[i], 0.0f, 1.0f, 0.0f);
        
        drawSphere(p.radius, p.r, p.g, p.b);
        
        // 土星环
        if (strcmp(p.name, "土星") == 0) {
            drawSaturnRing(p.radius);
        }
        
        if (showLabels) {
            drawLabel(p.name, 0.0f, p.radius + 0.25f, 0.0f, p.r, p.g, p.b);
        }
        
        glPopMatrix();
    }
    
    glutSwapBuffers();
}

// 定时器回调函数
void timer(int value) {
    updatePlanets();
    glutPostRedisplay();
    glutTimerFunc(16, timer, 0); // 约60 FPS
}

// 窗口大小改变回调
void reshape(int w, int h) {
    glViewport(0, 0, w, h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    
    float aspect = (float)w / (float)h;
    
    if (orthoMode) {
        // 正交投影
        float size = 15.0f;
        if (aspect > 1.0f) {
            glOrtho(-size * aspect, size * aspect, -size, size, 1.0f, 100.0f);
        } else {
            glOrtho(-size, size, -size / aspect, size / aspect, 1.0f, 100.0f);
        }
    } else {
        // 透视投影
        gluPerspective(fieldOfView, aspect, 1.0f, 100.0f);
    }
    
    glMatrixMode(GL_MODELVIEW);
}

// 键盘回调
void keyboard(unsigned char key, int x, int y) {
    switch (key) {
        case 27: // ESC
        case 'q':
            exit(0);
            break;
        case ' ':
            animationEnabled = !animationEnabled;
            printf("动画 %s\n", animationEnabled ? "启动" : "暂停");
            break;
        case 'o':
            showOrbits = !showOrbits;
            printf("轨道 %s\n", showOrbits ? "显示" : "隐藏");
            break;
        case 'l':
            showLabels = !showLabels;
            printf("标签 %s\n", showLabels ? "显示" : "隐藏");
            break;
        case 's':
            showStars = !showStars;
            printf("星空 %s\n", showStars ? "显示" : "隐藏");
            break;
        case 'p':
            orthoMode = !orthoMode;
            reshape(glutGet(GLUT_WINDOW_WIDTH), glutGet(GLUT_WINDOW_HEIGHT));
            printf("投影模式: %s\n", orthoMode ? "正交" : "透视");
            break;
        case '+':
        case '=':
            timeScale += 0.1f;
            if (timeScale > 3.0f) timeScale = 3.0f;
            printf("速度倍率: %.1f\n", timeScale);
            break;
        case '-':
            timeScale -= 0.1f;
            if (timeScale < 0.1f) timeScale = 0.1f;
            printf("速度倍率: %.1f\n", timeScale);
            break;
        case 'r':
            cameraAngleX = 25.0f;
            cameraAngleY = -30.0f;
            cameraDistance = 25.0f;
            printf("相机重置\n");
            break;
        default:
            break;
    }
    glutPostRedisplay();
}

// 鼠标按键回调
void mouse(int button, int state, int x, int y) {
    if (button == GLUT_LEFT_BUTTON) {
        if (state == GLUT_DOWN) {
            mousePressed = true;
            lastMouseX = x;
            lastMouseY = y;
        } else {
            mousePressed = false;
        }
    }
    // 处理鼠标滚轮（在某些GLUT实现中，滚轮会触发button事件）
    #ifdef GLUT_WHEEL_UP
    else if (button == GLUT_WHEEL_UP) {
        cameraDistance -= 1.0f;
        if (cameraDistance < 8.0f) cameraDistance = 8.0f;
        glutPostRedisplay();
    }
    else if (button == GLUT_WHEEL_DOWN) {
        cameraDistance += 1.0f;
        if (cameraDistance > 50.0f) cameraDistance = 50.0f;
        glutPostRedisplay();
    }
    #endif
}

// 鼠标移动回调
void motion(int x, int y) {
    if (mousePressed) {
        cameraAngleX += (x - lastMouseX) * 0.5f;
        cameraAngleY += (y - lastMouseY) * 0.5f;
        
        // 限制垂直角度
        if (cameraAngleY > 80.0f) cameraAngleY = 80.0f;
        if (cameraAngleY < -80.0f) cameraAngleY = -80.0f;
        
        lastMouseX = x;
        lastMouseY = y;
        glutPostRedisplay();
    }
}

// 初始化OpenGL
void initOpenGL() {
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_LIGHTING);
    glEnable(GL_LIGHT0);
    glEnable(GL_COLOR_MATERIAL);
    glEnable(GL_NORMALIZE);
    
    // 设置光照参数
    GLfloat lightAmbient[] = { 0.2f, 0.2f, 0.2f, 1.0f };
    GLfloat lightDiffuse[] = { 0.8f, 0.8f, 0.8f, 1.0f };
    GLfloat lightSpecular[] = { 0.5f, 0.5f, 0.5f, 1.0f };
    
    glLightfv(GL_LIGHT0, GL_AMBIENT, lightAmbient);
    glLightfv(GL_LIGHT0, GL_DIFFUSE, lightDiffuse);
    glLightfv(GL_LIGHT0, GL_SPECULAR, lightSpecular);
    
    // 设置全局环境光
    GLfloat globalAmbient[] = { 0.1f, 0.1f, 0.1f, 1.0f };
    glLightModelfv(GL_LIGHT_MODEL_AMBIENT, globalAmbient);
    
    // 设置材质属性
    glColorMaterial(GL_FRONT, GL_AMBIENT_AND_DIFFUSE);
}

// 打印帮助信息
void printHelp() {
    printf("\n========== 太阳系模拟程序 ==========\n");
    printf("控制说明:\n");
    printf("  鼠标拖动 - 旋转视角\n");
    printf("  鼠标滚轮 - 拉近/拉远\n");
    printf("  空格键   - 暂停/继续动画\n");
    printf("  O键     - 显示/隐藏轨道\n");
    printf("  L键     - 显示/隐藏标签\n");
    printf("  S键     - 显示/隐藏星空\n");
    printf("  P键     - 切换透视/正交投影\n");
    printf("  +/-键   - 增加/减少速度倍率\n");
    printf("  R键     - 重置相机视角\n");
    printf("  ESC/Q键 - 退出程序\n");
    printf("===================================\n\n");
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH);
    glutInitWindowSize(1024, 768);
    glutCreateWindow("太阳系模拟 - OpenGL");
    
    initOpenGL();
    initStars();
    printHelp();
    
    // 注册回调函数
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutKeyboardFunc(keyboard);
    glutMouseFunc(mouse);
    glutMotionFunc(motion);
    glutTimerFunc(0, timer, 0);
    
    glutMainLoop();
    
    return 0;
}