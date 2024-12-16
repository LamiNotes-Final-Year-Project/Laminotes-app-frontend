import 'package:flutter/material.dart';

class TabBarViewWidget extends StatelessWidget {
  const TabBarViewWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: Colors.blueGrey[900],
            child: const TabBar(
              labelColor: Colors.white,
              unselectedLabelColor: Colors.grey,
              indicatorColor: Colors.cyanAccent,
              tabs: [
                Tab(icon: Icon(Icons.login), text: "Login"),
                Tab(icon: Icon(Icons.person_add), text: "Register"),
              ],
            ),
          ),
          const Expanded(
            child: TabBarView(
              children: [
                _LoginTab(),
                _RegisterTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LoginTab extends StatelessWidget {
  const _LoginTab();

  @override
  Widget build(BuildContext context) {
    return _AuthForm(title: 'Login', buttonText: 'Log In');
  }
}

class _RegisterTab extends StatelessWidget {
  const _RegisterTab();

  @override
  Widget build(BuildContext context) {
    return _AuthForm(title: 'Register', buttonText: 'Sign Up');
  }
}

class _AuthForm extends StatelessWidget {
  final String title;
  final String buttonText;

  const _AuthForm({required this.title, required this.buttonText});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.blueGrey,
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            decoration: InputDecoration(
              labelText: 'Email',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 15),
          TextField(
            obscureText: true,
            decoration: InputDecoration(
              labelText: 'Password',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.cyanAccent,
              foregroundColor: Colors.blueGrey[900],
              padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 20),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Center(
              child: Text(
                buttonText,
                style: const TextStyle(fontSize: 18),
              ),
            ),
          ),
        ],
      ),
    );
  }
}