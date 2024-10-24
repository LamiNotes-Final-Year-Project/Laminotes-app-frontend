import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Define the new color palette
    final Color primaryColor = const Color(0xFF6F3573);
    final Color secondaryColor = const Color(0xFFE49060);
    final Color accentColor = const Color(0xFFB64D5A);
    final Color backgroundColor = const Color(0xFFF7EB74); 
    const Color textColor = Colors.black; 

    return MaterialApp(
      title: 'Laminotes',
      theme: ThemeData(
        primaryColor: primaryColor,
        scaffoldBackgroundColor: backgroundColor,
        appBarTheme: AppBarTheme(
          color: primaryColor,
          titleTextStyle: const TextStyle(color: Colors.black, fontSize: 20),
        ),
        buttonTheme: ButtonThemeData(
          buttonColor: secondaryColor,
          textTheme: ButtonTextTheme.primary,
        ),
        textTheme: TextTheme(
          bodyLarge: TextStyle(color: textColor),
          bodyMedium: TextStyle(color: textColor),
        ),
      ),
      home: const NoteAppLayout(),
    );
  }
}

class NoteAppLayout extends StatefulWidget {
  const NoteAppLayout({super.key});

  @override
  _NoteAppLayoutState createState() => _NoteAppLayoutState();
}

class _NoteAppLayoutState extends State<NoteAppLayout> {
  // State variables to manage sidebar open/close
  bool isLeftSidebarOpen = true;
  bool isRightSidebarOpen = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Laminotes'),
        // Placing the floating button directly inside the app bar
        leading: IconButton(
          icon: Icon(isLeftSidebarOpen ? Icons.close : Icons.menu),
          onPressed: () {
            setState(() {
              isLeftSidebarOpen = !isLeftSidebarOpen;
            });
          },
        ),
        actions: [
          IconButton(
            icon: Icon(isRightSidebarOpen ? Icons.close : Icons.menu),
            onPressed: () {
              setState(() {
                isRightSidebarOpen = !isRightSidebarOpen;
              });
            },
          ),
        ],
      ),
      body: Row(
        children: [
          // Left sidebar
          if (isLeftSidebarOpen)
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: isLeftSidebarOpen ? 250 : 0, // Sidebar width
              color: Theme.of(context).colorScheme.secondary, 
              child: Column(
                children: [
                  DrawerHeader(
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.secondary,
                    ),
                    child: const Text('User Workspace', style: TextStyle(color: Colors.white)),
                  ),
                  // TODO: remove placeholder, implement actual file list
                  const ListTile(title: Text('File 1', style: TextStyle(color: Colors.white))),
                  const ListTile(title: Text('File 2', style: TextStyle(color: Colors.white))),
                  const ListTile(title: Text('File 3', style: TextStyle(color: Colors.white))),
                  const ListTile(title: Text('File 4', style: TextStyle(color: Colors.white))),
                  const ListTile(title: Text('File 5', style: TextStyle(color: Colors.white))),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () {
                      setState(() {
                        isLeftSidebarOpen = false;
                      });
                    },
                  ),
                ],
              ),
            ),

          // Main content (Editor + Preview)
          Expanded(
            flex: 5,
            child: Row(
              children: [
                // Text Editor
                const Expanded(
                  flex: 3,
                  child: Padding(
                    padding: EdgeInsets.all(8.0),
                    child: Column(
                      children: [
                        Text(
                          'Editor',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        Expanded(
                          child: TextField(
                            maxLines: null,
                            decoration: InputDecoration(
                              hintText: 'Start typing your text...',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const VerticalDivider(
                  width: 1,
                  color: Colors.grey,
                ),
                // Preview Window TODO: Implement actual preview
                Expanded(
                  flex: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Column(
                      children: [
                        const Text(
                          'Preview',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        Expanded(
                          child: Container(
                            color: Colors.white,
                            child: const Center(
                              child: Text(
                                'Preview will appear here...',
                                style: TextStyle(fontSize: 16),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Right sidebar
          if (isRightSidebarOpen)
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: isRightSidebarOpen ? 250 : 0,
              color: Theme.of(context).colorScheme.secondary, 
              child: Column(
                children: [
                  DrawerHeader(
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.secondary, 
                    ),
                    child: const Text('Right Sidebar', style: TextStyle(color: Colors.white)),
                  ),
                  // TODO: remove placeholder, implement actual options
                  const ListTile(title: Text('Option 1', style: TextStyle(color: Colors.white))),
                  const ListTile(title: Text('Option 2', style: TextStyle(color: Colors.white))),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () {
                      setState(() {
                        isRightSidebarOpen = false;
                      });
                    },
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}